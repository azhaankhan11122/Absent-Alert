import os
import pandas as pd
from flask import Flask, render_template, request, redirect, url_for, flash
from werkzeug.utils import secure_filename
from models import db, Student, Attendance, SMSMessage
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///attendance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'app/static/uploads'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return redirect(url_for('students'))

@app.route('/students', methods=['GET', 'POST'])
def students():
    search_query = request.args.get('search', '')

    if request.method == 'POST':
        if 'file' in request.files:
            # File upload handling
            file = request.files['file']
            if file.filename != '':
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)

                try:
                    if filename.endswith('.csv'):
                        df = pd.read_csv(filepath)
                    elif filename.endswith('.xlsx'):
                        df = pd.read_excel(filepath)
                    else:
                        flash('Unsupported file format.', 'error')
                        return redirect(url_for('students'))

                    for index, row in df.iterrows():
                        if not Student.query.filter_by(roll_number=str(row['roll_number'])).first():
                            student = Student(
                                name=row['name'],
                                roll_number=str(row['roll_number']),
                                class_name=str(row['class_name']),
                                phone_number=str(row.get('phone_number', '')),
                                parent_phone=str(row['parent_phone'])
                            )
                            db.session.add(student)
                    db.session.commit()
                    flash('Students imported successfully!', 'success')
                except Exception as e:
                    db.session.rollback()
                    flash(f'Error importing file: {str(e)}', 'error')

        else:
            # Single student add handling
            name = request.form.get('name')
            roll_number = request.form.get('roll_number')
            class_name = request.form.get('class_name')
            phone_number = request.form.get('phone_number')
            parent_phone = request.form.get('parent_phone')

            if not Student.query.filter_by(roll_number=roll_number).first():
                student = Student(
                    name=name,
                    roll_number=roll_number,
                    class_name=class_name,
                    phone_number=phone_number,
                    parent_phone=parent_phone
                )
                db.session.add(student)
                db.session.commit()
                flash('Student added successfully!', 'success')
            else:
                flash('Student with this roll number already exists.', 'error')

        return redirect(url_for('students'))

    if search_query:
        students_list = Student.query.filter(
            Student.name.ilike(f'%{search_query}%') |
            Student.roll_number.ilike(f'%{search_query}%') |
            Student.class_name.ilike(f'%{search_query}%')
        ).all()
    else:
        students_list = Student.query.all()

    return render_template('students.html', students=students_list, search_query=search_query)

@app.route('/student/edit/<int:id>', methods=['GET', 'POST'])
def edit_student(id):
    student = Student.query.get_or_404(id)
    if request.method == 'POST':
        student.name = request.form.get('name')
        student.roll_number = request.form.get('roll_number')
        student.class_name = request.form.get('class_name')
        student.phone_number = request.form.get('phone_number')
        student.parent_phone = request.form.get('parent_phone')
        db.session.commit()
        flash('Student updated successfully!', 'success')
        return redirect(url_for('students'))
    return render_template('edit_student.html', student=student)

@app.route('/student/delete/<int:id>')
def delete_student(id):
    student = Student.query.get_or_404(id)
    db.session.delete(student)
    db.session.commit()
    flash('Student deleted successfully!', 'success')
    return redirect(url_for('students'))

@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    classes = db.session.query(Student.class_name).distinct().all()
    class_names = [c[0] for c in classes]

    selected_class = request.args.get('class_name', class_names[0] if class_names else None)
    target_date_str = request.args.get('date', datetime.utcnow().date().isoformat())
    target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()

    if request.method == 'POST':
        # Process attendance submission
        student_id = request.form.get('student_id')
        status = request.form.get('status')
        date_str = request.form.get('date')
        att_date = datetime.strptime(date_str, '%Y-%m-%d').date()

        # Check if attendance already exists
        attendance = Attendance.query.filter_by(student_id=student_id, date=att_date).first()
        if attendance:
            attendance.status = status
        else:
            attendance = Attendance(student_id=student_id, date=att_date, status=status)
            db.session.add(attendance)

        # Queue SMS if absent
        if status == 'absent':
            student = Student.query.get(student_id)
            if student:
                # Check if SMS already queued for this date to avoid duplicates
                existing_sms = SMSMessage.query.filter(
                    SMSMessage.phone_number == student.parent_phone,
                    SMSMessage.message_body.like(f"%{att_date}%")
                ).first()

                if not existing_sms:
                    msg_body = f"Alert: {student.name} (Roll: {student.roll_number}) is absent today ({att_date})."
                    sms = SMSMessage(phone_number=student.parent_phone, message_body=msg_body)
                    db.session.add(sms)

        db.session.commit()
        return redirect(url_for('dashboard', class_name=selected_class, date=date_str))

    # Fetch students for the selected class
    students_in_class = []
    if selected_class:
        students_in_class = Student.query.filter_by(class_name=selected_class).all()

    # Build attendance dictionary for the current view
    attendance_data = {}
    for student in students_in_class:
        att = Attendance.query.filter_by(student_id=student.id, date=target_date).first()
        attendance_data[student.id] = att.status if att else 'unmarked'

    # Prepare data for Chart.js
    # Trend over the last 7 days for the selected class
    trend_labels = []
    trend_present = []
    trend_absent = []

    if selected_class:
        import datetime as dt
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            d = today - dt.timedelta(days=i)
            trend_labels.append(d.strftime('%Y-%m-%d'))

            # Count present
            present_count = db.session.query(Attendance).join(Student).filter(
                Student.class_name == selected_class,
                Attendance.date == d,
                Attendance.status == 'present'
            ).count()

            # Count absent
            absent_count = db.session.query(Attendance).join(Student).filter(
                Student.class_name == selected_class,
                Attendance.date == d,
                Attendance.status == 'absent'
            ).count()

            trend_present.append(present_count)
            trend_absent.append(absent_count)

    return render_template(
        'dashboard.html',
        classes=class_names,
        selected_class=selected_class,
        target_date=target_date_str,
        students=students_in_class,
        attendance_data=attendance_data,
        trend_labels=trend_labels,
        trend_present=trend_present,
        trend_absent=trend_absent
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)
