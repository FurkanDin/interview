FROM php:8.2-apache

# Gerekli sistem paketlerini kuralım
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Apache mod_rewrite aktif edelim (Routing için şart)
RUN a2enmod rewrite

# Composer kuralım
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Çalışma dizinini ayarlayalım
WORKDIR /var/www/html

# Composer dosyalarını kopyalayıp bağımlılıkları kuralım
COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader

# Tüm proje dosyalarını kopyalayalım
COPY . .

# İzinleri ayarlayalım (Apache www-data kullanıcısı için)
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80
