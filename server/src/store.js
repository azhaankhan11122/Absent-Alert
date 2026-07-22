import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';

const DEFAULT_DATA = {
  students: [],
  attendance: [],
  smsQueue: [],
  settings: {
    schoolName: 'Absent Alert',
    absentSmsTemplate: 'Dear parent, {name} ({rollNo}) from class {className} is absent on {date}.',
    absentWhatsAppTemplate: '{name} has missed {subjectName} from {startTime} to {endTime}'
  }
};

export class JsonStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write(DEFAULT_DATA);
    }
  }

  async read() {
    try {
      await this.writeChain;
    } catch {}
    const raw = await fs.readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const result = { ...structuredClone(DEFAULT_DATA), ...parsed };
    result.settings = { ...DEFAULT_DATA.settings, ...parsed.settings };
    return result;
  }

  async write(data) {
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data, null, 2));
    await fs.rename(temp, this.filePath);
  }

  async update(mutator) {
    const prev = this.writeChain;
    this.writeChain = (async () => {
      try {
        await prev;
      } catch {}
      let data;
      try {
        data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      } catch {
        data = structuredClone(DEFAULT_DATA);
      }
      const parsed = data;
      data = { ...structuredClone(DEFAULT_DATA), ...parsed };
      data.settings = { ...DEFAULT_DATA.settings, ...parsed.settings };
      const result = await mutator(data);
      await this.write(data);
      return result;
    })();
    return this.writeChain;
  }
}

export const newId = (prefix) => `${prefix}_${nanoid(10)}`;
