import { newId } from '../store.js';
import { renderTemplate, todayISO } from '../utils/normalize.js';

const dueNow = (job) => !job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= Date.now();
const backoffMinutes = (attempts) => Math.min(60, 2 ** Math.max(0, attempts - 1));

export class SmsQueueService {
  constructor(store, gateway, config) {
    this.store = store;
    this.gateway = gateway;
    this.config = config;
    this.timer = null;
    this.processing = false;
  }

  start() {
    this.timer = setInterval(() => this.process().catch(console.error), this.config.queueIntervalMs);
    this.process().catch(console.error);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueueAbsentAlerts({ date = todayISO(), className, studentIds = [] } = {}) {
    return this.store.update((data) => {
      const students = data.students.filter((student) => {
        if (studentIds.length && !studentIds.includes(student.id)) return false;
        if (className && student.className !== className) return false;
        const record = data.attendance.find((row) => row.studentId === student.id && row.date === date);
        return record?.status === 'absent' && student.parentPhone;
      });

      const queued = [];
      for (const student of students) {
        const existing = data.smsQueue.find((job) => job.studentId === student.id && job.date === date && ['queued', 'processing', 'sent'].includes(job.status));
        if (existing) continue;
        const job = {
          id: newId('sms'),
          studentId: student.id,
          phone: student.parentPhone,
          message: renderTemplate(data.settings.absentSmsTemplate, student, date),
          date,
          status: 'queued',
          attempts: 0,
          maxAttempts: this.config.maxSmsAttempts,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastError: null,
          providerResponse: null
        };
        data.smsQueue.push(job);
        queued.push(job);
      }
      return queued;
    });
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
      const data = await this.store.read();
      const next = data.smsQueue.find((job) => job.status === 'queued' && dueNow(job));
      if (!next) return;

      await this.store.update((state) => {
        const job = state.smsQueue.find((item) => item.id === next.id);
        if (job && job.status === 'queued') {
          job.status = 'processing';
          job.attempts += 1;
          job.updatedAt = new Date().toISOString();
        }
      });

      try {
        const response = await this.gateway.sendSms(next.phone, next.message);
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
    } finally {
      this.processing = false;
    }
  }
}
