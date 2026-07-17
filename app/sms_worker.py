import time
import subprocess
from datetime import datetime
from app import app, db
from models import SMSMessage

def send_sms_via_adb(phone_number, message):
    """
    Sends an SMS using ADB via a connected Android phone.
    Requires ADB to be installed and the phone to be connected via USB with USB debugging enabled.
    """
    try:
        # Check if device is connected
        devices_output = subprocess.check_output(['adb', 'devices']).decode('utf-8')
        if 'device' not in devices_output.split('\n')[1]:
             return False, "No ADB device connected."

        # Command to send SMS via ADB intent
        # adb shell am start -a android.intent.action.SENDTO -d sms:PHONE_NUMBER --es sms_body "MESSAGE" --ez exit_on_sent true
        # Wait a moment, then press the send button (keyevent 22 then 66, or keyevent 61 then 66 depending on device)
        # Note: A more reliable programmatic way on modern Android is sending via service call, but it varies by Android version.
        # Here we use the intent method as a common denominator, or service call if known.

        # Using service call isms (works on many devices without UI interaction)
        # However, since the exact transaction code varies, we will use the intent method and simulate button press.

        # Open SMS app with number and text
        cmd_open = [
            'adb', 'shell', 'am', 'start', '-a', 'android.intent.action.SENDTO',
            '-d', f'sms:{phone_number}',
            '--es', 'sms_body', f'"{message}"',
            '--ez', 'exit_on_sent', 'true'
        ]

        subprocess.run(cmd_open, check=True, capture_output=True)
        time.sleep(2) # Wait for app to open

        # Simulate pressing TAB to focus send button and ENTER to send
        # This is a basic implementation; in a real-world scenario, you might need
        # a dedicated SMS gateway app installed on the phone that exposes an HTTP API.
        subprocess.run(['adb', 'shell', 'input', 'keyevent', '22'], check=True) # Right arrow / Tab
        time.sleep(0.5)
        subprocess.run(['adb', 'shell', 'input', 'keyevent', '66'], check=True) # Enter
        time.sleep(1)

        # Go home
        subprocess.run(['adb', 'shell', 'input', 'keyevent', '3'], check=True) # Home

        return True, None
    except subprocess.CalledProcessError as e:
        return False, f"ADB Command failed: {e.stderr.decode('utf-8') if e.stderr else str(e)}"
    except FileNotFoundError:
         return False, "ADB executable not found. Please install Android Platform Tools."
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"

def process_sms_queue():
    """Polls the database for pending SMS messages and attempts to send them."""
    with app.app_context():
        print(f"[{datetime.utcnow()}] Checking for pending SMS messages...")
        pending_messages = SMSMessage.query.filter_by(status='pending').all()

        for msg in pending_messages:
            print(f"Attempting to send SMS to {msg.phone_number}: {msg.message_body}")
            success, error = send_sms_via_adb(msg.phone_number, msg.message_body)

            if success:
                msg.status = 'sent'
                msg.sent_at = datetime.utcnow()
                print(f"Successfully sent SMS to {msg.phone_number}")
            else:
                msg.status = 'failed'
                msg.error_message = error
                print(f"Failed to send SMS to {msg.phone_number}: {error}")

            db.session.commit()
            time.sleep(1) # Prevent flooding

if __name__ == '__main__':
    print("Starting Background SMS Worker...")
    while True:
        try:
            process_sms_queue()
        except Exception as e:
            print(f"Error in worker loop: {e}")
        time.sleep(10) # Poll every 10 seconds
