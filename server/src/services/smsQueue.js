import { newId } from '../store.js';
import { renderTemplate, todayISO } from '../utils/normalize.js';

const dueNow = (job) => !job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= Date.now();
const backoffMinutes = (attempts) => Math.min(60, 2 ** Math.max(0, attempts - 1));

export class SmsQueueService {
  constructor(store, smsGateway, whatsappGateway, config) {
    this.store = store;
    this.smsGateway = smsGateway;
    this.whatsappGateway = whatsappGateway;
    this.config = config;
    this.timer = null;
    this.processing = false;
  }

  async recoverOrphanedJobs() {
    await this.store.update((data) => {
      let count = 0;
      for (const job of data.smsQueue) {
        if (job.status === 'processing') {
          job.status = 'queued';
          job.updatedAt = new Date().toISOString();
          count++;
        }
      }
      if (count > 0) {
        console.log(`Recovered ${count} orphaned processing jobs in queue.`);
      }
    });
  }

  start() {
    this.recoverOrphanedJobs().then(() => {
      this.timer = setInterval(() => this.process().catch(console.error), this.config.queueIntervalMs);
      this.process().catch(console.error);
    }).catch(console.error);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueueAbsentAlerts({ date = todayISO(), className, year, studentIds = [] } = {}) {
    return this.store.update((data) => {
      const students = data.students.filter((student) => {
        if (studentIds.length && !studentIds.includes(student.id)) return false;
        if (className && student.className !== className) return false;
        if (year && student.year !== year) return false;
        const record = data.attendance.find((row) => row.studentId === student.id && row.date === date);
        return record?.status === 'absent' && student.parentPhone && !student.shariyath;
      });

      const queued = [];
      for (const student of students) {
        const phones = student.parentPhone.split(' / ');
        const record = data.attendance.find((row) => row.studentId === student.id && row.date === date) || {};
        const message = renderTemplate(data.settings.absentSmsTemplate, student, record, date);
        
        for (const phone of phones) {
          const existing = data.smsQueue.find((job) => job.studentId === student.id && job.phone === phone && job.date === date && job.message === message && ['queued', 'processing', 'sent'].includes(job.status));
          if (existing) continue;
          const job = this.createJob(student, message, date, 'sms', phone);
          data.smsQueue.push(job);
          queued.push(job);
        }
      }
      return queued;
    });
  }

  async enqueueAbsentWhatsAppAlerts({ date = todayISO(), className, year, studentIds = [] } = {}) {
    return this.store.update((data) => {
      const students = data.students.filter((student) => {
        if (studentIds.length && !studentIds.includes(student.id)) return false;
        if (className && student.className !== className) return false;
        if (year && student.year !== year) return false;
        const record = data.attendance.find((row) => row.studentId === student.id && row.date === date);
        return record?.status === 'absent' && student.parentPhone && !student.shariyath;
      });

      const queued = [];
      for (const student of students) {
        const phones = student.parentPhone.split(' / ');
        const record = data.attendance.find((row) => row.studentId === student.id && row.date === date) || {};
        const message = renderTemplate(data.settings.absentWhatsAppTemplate, student, record, date);

        for (const phone of phones) {
          const existing = data.smsQueue.find((job) => job.studentId === student.id && job.phone === phone && job.date === date && job.message === message && ['queued', 'processing', 'sent'].includes(job.status) && job.provider === 'whatsapp');
          if (existing) continue;
          const job = this.createJob(student, message, date, 'whatsapp', phone);
          data.smsQueue.push(job);
          queued.push(job);
        }
      }
      return queued;
    });
  }

  createJob(student, message, date, provider, phone) {
    return {
      id: newId('sms'),
      studentId: student.id,
      phone: phone || student.parentPhone,
      message,
      date,
      provider,
      status: 'queued',
      attempts: 0,
      maxAttempts: this.config.maxSmsAttempts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: null,
      providerResponse: null
    };
  }

  async list() {
    const data = await this.store.read();
    return data.smsQueue.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async retry(jobId) {
    return this.store.update((data) => {
      const job = data.smsQueue.find((item) => item.id === jobId);
      if (!job) return null;
      job.status = 'queued';
      job.nextAttemptAt = null;
      job.updatedAt = new Date().toISOString();
      return job;
    });
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (true) {
        const data = await this.store.read();
        const next = data.smsQueue.find((job) => job.status === 'queued' && dueNow(job));
        if (!next) break;

        await this.store.update((state) => {
          const job = state.smsQueue.find((item) => item.id === next.id);
          if (job && job.status === 'queued') {
            job.status = 'processing';
            job.attempts += 1;
            job.updatedAt = new Date().toISOString();
          }
        });

        try {
          const response = next.provider === 'whatsapp'
            ? await this.whatsappGateway.sendWhatsApp(next.phone, next.message)
            : await this.smsGateway.sendSms(next.phone, next.message);
          await this.store.update((state) => {
            const job = state.smsQueue.find((item) => item.id === next.id);
            if (!job) return;
            job.status = 'sent';
            job.sentAt = new Date().toISOString();
            job.updatedAt = new Date().toISOString();
            job.providerResponse = response;
            job.lastError = null;
          });
        } catch (error) {
          await this.store.update((state) => {
            const job = state.smsQueue.find((item) => item.id === next.id);
            if (!job) return;
            job.lastError = error.message;
            job.updatedAt = new Date().toISOString();
            if (job.attempts >= job.maxAttempts) {
              job.status = 'failed';
            } else {
              job.status = 'queued';
              job.nextAttemptAt = new Date(Date.now() + backoffMinutes(job.attempts) * 60000).toISOString();
            }
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
