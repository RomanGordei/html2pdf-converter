from flask import Blueprint, render_template, request, jsonify, send_file, current_app
from weasyprint import HTML, CSS
from werkzeug.utils import secure_filename
import os
import uuid
import zipfile
import io
import shutil
from datetime import datetime

main = Blueprint('main', __name__)

ALLOWED_EXTENSIONS = {'html', 'htm'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_russian_filename(original_name):
    """Генерирует имя PDF-файла на основе оригинального HTML"""
    base_name = os.path.splitext(original_name)[0]
    return f"{base_name}.pdf"


@main.route('/')
def index():
    return render_template('index.html')


@main.route('/convert', methods=['POST'])
def convert():
    if 'files[]' not in request.files:
        return jsonify({'error': 'Файлы не выбраны'}), 400
    
    files = request.files.getlist('files[]')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'Файлы не выбраны'}), 400
    
    # Уникальная папка для этой сессии конвертации
    session_id = str(uuid.uuid4())
    session_upload = os.path.join(current_app.config['UPLOAD_FOLDER'], session_id)
    session_output = os.path.join(current_app.config['OUTPUT_FOLDER'], session_id)
    
    os.makedirs(session_upload, exist_ok=True)
    os.makedirs(session_output, exist_ok=True)
    
    converted_files = []
    errors = []
    
    for file in files:
        if file.filename == '':
            continue
            
        if not allowed_file(file.filename):
            errors.append(f"'{file.filename}' — неподдерживаемый формат")
            continue
        
        try:
            # Сохраняем HTML
            filename = secure_filename(file.filename)
            # Если имя файла было полностью кириллическим, secure_filename вернёт пустую строку
            if not filename:
                filename = f"file_{uuid.uuid4().hex[:8]}.html"
            
            html_path = os.path.join(session_upload, filename)
            file.save(html_path)
            
            # Конвертируем в PDF
            pdf_filename = get_russian_filename(filename)
            pdf_path = os.path.join(session_output, pdf_filename)
            
            # Читаем HTML и конвертируем
            html_content = HTML(filename=html_path)
            
            # Базовые стили для лучшего отображения
            base_css = CSS(string='''
                @page {
                    size: A4;
                    margin: 2cm;
                }
                body {
                    font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
                    line-height: 1.5;
                }
            ''')
            
            html_content.write_pdf(pdf_path, stylesheets=[base_css])
            
            converted_files.append({
                'original': file.filename,
                'pdf': pdf_filename,
                'session_id': session_id
            })
            
        except Exception as e:
            errors.append(f"'{file.filename}' — ошибка: {str(e)}")
    
    if not converted_files:
        # Удаляем пустые папки
        shutil.rmtree(session_upload, ignore_errors=True)
        shutil.rmtree(session_output, ignore_errors=True)
        return jsonify({'error': 'Не удалось сконвертировать файлы', 'details': errors}), 400
    
    return jsonify({
        'success': True,
        'converted': converted_files,
        'errors': errors,
        'session_id': session_id
    })


@main.route('/download/<session_id>/<filename>')
def download_file(session_id, filename):
    """Скачивание одного PDF файла"""
    safe_filename = secure_filename(filename)
    if not safe_filename:
        safe_filename = filename
    
    file_path = os.path.join(current_app.config['OUTPUT_FOLDER'], session_id, safe_filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'Файл не найден'}), 404
    
    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename,
        mimetype='application/pdf'
    )


@main.route('/download-all/<session_id>')
def download_all(session_id):
    """Скачивание всех PDF файлов архивом"""
    output_folder = os.path.join(current_app.config['OUTPUT_FOLDER'], session_id)
    
    if not os.path.exists(output_folder):
        return jsonify({'error': 'Сессия не найдена'}), 404
    
    # Создаём архив в памяти
    memory_file = io.BytesIO()
    
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filename in os.listdir(output_folder):
            file_path = os.path.join(output_folder, filename)
            if os.path.isfile(file_path) and filename.endswith('.pdf'):
                zf.write(file_path, filename)
    
    memory_file.seek(0)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    return send_file(
        memory_file,
        as_attachment=True,
        download_name=f'pdf_файлы_{timestamp}.zip',
        mimetype='application/zip'
    )


@main.route('/cleanup/<session_id>', methods=['POST'])
def cleanup(session_id):
    """Очистка временных файлов сессии"""
    upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], session_id)
    output_folder = os.path.join(current_app.config['OUTPUT_FOLDER'], session_id)
    
    shutil.rmtree(upload_folder, ignore_errors=True)
    shutil.rmtree(output_folder, ignore_errors=True)
    
    return jsonify({'success': True})
