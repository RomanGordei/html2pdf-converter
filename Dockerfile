# Используем Python 3.11 slim
FROM python:3.11-slim-bookworm

# Метаданные
LABEL maintainer="your-email@example.com"
LABEL description="HTML to PDF Converter"

# Устанавливаем системные зависимости для WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Зависимости WeasyPrint
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    # Шрифты с поддержкой кириллицы
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    # Очистка кэша
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /app

# Копируем зависимости и устанавливаем
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем приложение
COPY . .

# Создаём директории для файлов
RUN mkdir -p uploads outputs

# Порт
EXPOSE 5000

# Запуск через gunicorn для продакшена
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "run:app"]
