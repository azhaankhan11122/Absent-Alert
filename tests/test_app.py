import pytest
import os
import sys
from datetime import datetime

# Add app directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../app')))

from app import app, db
from models import Student, Attendance, SMSMessage
from sms_worker import process_sms_queue, send_sms_via_adb

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_add_student(client):
    response = client.post('/students', data={
        'name': 'John Doe',
        'roll_number': '101',
        'class_name': '10A',
        'phone_number': '1234567890',
        'parent_phone': '0987654321'
    }, follow_redirects=True)

    assert b'Student added successfully!' in response.data

    with app.app_context():
        student = Student.query.filter_by(roll_number='101').first()
        assert student is not None
        assert student.name == 'John Doe'

def test_mark_attendance_absent_queues_sms(client):
    with app.app_context():
        student = Student(name='Jane Doe', roll_number='102', class_name='10B', parent_phone='1112223333')
        db.session.add(student)
        db.session.commit()
        student_id = student.id

    date_str = '2023-10-26'
    response = client.post(f'/dashboard?class_name=10B&date={date_str}', data={
        'student_id': student_id,
        'status': 'absent',
        'date': date_str
    }, follow_redirects=True)

    with app.app_context():
        att = Attendance.query.filter_by(student_id=student_id).first()
        assert att is not None
        assert att.status == 'absent'

        sms = SMSMessage.query.filter_by(phone_number='1112223333').first()
        assert sms is not None
        assert sms.status == 'pending'
        assert 'absent' in sms.message_body.lower()

# Mocking subprocess for sms_worker test
def test_sms_worker(monkeypatch, client):
    # Setup test data
    with app.app_context():
        sms = SMSMessage(phone_number='5555555', message_body='Test MSG', status='pending')
        db.session.add(sms)
        db.session.commit()

    # Mock the send function to simulate success
    def mock_send(phone, msg):
        return True, None

    monkeypatch.setattr('sms_worker.send_sms_via_adb', mock_send)

    # Run the processor
    process_sms_queue()

    # Verify status changed
    with app.app_context():
        updated_sms = SMSMessage.query.filter_by(phone_number='5555555').first()
        assert updated_sms.status == 'sent'
