#!/bin/bash

# Generate self-signed SSL certificate for local development
# Usage: ./generate-ssl-cert.sh

DOMAIN="sitemapperpro.local.se"
CERT_DIR="./nginx/certs"

echo "🔐 Generating self-signed SSL certificate for $DOMAIN..."

# Create certs directory if it doesn't exist
mkdir -p $CERT_DIR

# Generate private key
openssl genrsa -out $CERT_DIR/$DOMAIN.key 2048

# Generate certificate signing request
openssl req -new -key $CERT_DIR/$DOMAIN.key \
  -out $CERT_DIR/$DOMAIN.csr \
  -subj "/C=SE/ST=Stockholm/L=Stockholm/O=SiteMapper Pro/OU=Development/CN=$DOMAIN"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 \
  -in $CERT_DIR/$DOMAIN.csr \
  -signkey $CERT_DIR/$DOMAIN.key \
  -out $CERT_DIR/$DOMAIN.crt

# Create a certificate bundle
cat $CERT_DIR/$DOMAIN.crt > $CERT_DIR/$DOMAIN.pem
cat $CERT_DIR/$DOMAIN.key >> $CERT_DIR/$DOMAIN.pem

# Clean up CSR file
rm $CERT_DIR/$DOMAIN.csr

# Set appropriate permissions
chmod 600 $CERT_DIR/$DOMAIN.key
chmod 644 $CERT_DIR/$DOMAIN.crt
chmod 600 $CERT_DIR/$DOMAIN.pem

echo "✅ SSL certificate generated successfully!"
echo ""
echo "Certificate files created:"
echo "  - Certificate: $CERT_DIR/$DOMAIN.crt"
echo "  - Private Key: $CERT_DIR/$DOMAIN.key"
echo "  - PEM Bundle: $CERT_DIR/$DOMAIN.pem"
echo ""
echo "⚠️  This is a self-signed certificate for local development."
echo "    Your browser will show a security warning."
echo "    Click 'Advanced' and 'Proceed to $DOMAIN' to continue."
echo ""
echo "🚀 Now you can run: docker-compose up -d"
echo "   And access: https://$DOMAIN"