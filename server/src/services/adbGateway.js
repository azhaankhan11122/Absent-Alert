import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function adbArgs(config, args) {
  const full = [];
  if (config.adbSerial) full.push('-s', config.adbSerial);
  return full.concat(args);
}

export class AdbSmsGateway {
  constructor(config) {
    this.config = config;
  }

  async runAdb(args, options = {}) {
    const { stdout, stderr } = await execFileAsync(this.config.adbPath, adbArgs(this.config, args), {
      timeout: options.timeout ?? 30000,
      maxBuffer: 1024 * 1024
    });
    return `${stdout}${stderr}`.trim();
  }

  async getStatus() {
    try {
      const output = await this.runAdb(['devices'], { timeout: 8000 });
      const lines = output.split('\n').slice(1).map((line) => line.trim()).filter(Boolean);
      const devices = lines.map((line) => {
        const [serial, state] = line.split(/\s+/);
        return { serial, state };
      });
      const selected = this.config.adbSerial
        ? devices.find((d) => d.serial === this.config.adbSerial)
        : devices.find((d) => d.state === 'device');
      return { ok: Boolean(selected && selected.state === 'device'), devices, selected, output };
    } catch (error) {
      return { ok: false, devices: [], error: error.message };
    }
  }

  async sendSms(phone, message) {
    const status = await this.getStatus();
    if (!status.ok) {
      throw new Error(`No usable Android device over ADB. ${status.error || 'Connect phone, enable USB debugging, and approve the RSA prompt.'}`);
    }

    if (this.config.gatewayMode === 'intent') {
      return this.sendSmsViaIntent(phone, message);
    }
    return this.sendSmsViaBroadcast(phone, message);
  }

  async sendSmsViaBroadcast(phone, message) {
    const args = [
      'shell', 'am', 'broadcast',
      '-a', this.config.gatewayAction,
      '--es', 'phone', phone,
      '--es', 'message', message
    ];
    if (this.config.gatewayPackage) args.splice(5, 0, '-p', this.config.gatewayPackage);
    const output = await this.runAdb(args, { timeout: 30000 });
    if (/result=0|Broadcast completed/i.test(output)) return output;
    return output || 'Broadcast sent';
  }

  async sendSmsViaIntent(phone, message) {
    // Opens the native SMS composer. This is useful for testing but usually requires user confirmation.
    return this.runAdb([
      'shell', 'am', 'start',
      '-a', 'android.intent.action.SENDTO',
      '-d', `sms:${phone}`,
      '--es', 'sms_body', message,
      '--ez', 'exit_on_sent', 'true'
    ], { timeout: 30000 });
  }
}
