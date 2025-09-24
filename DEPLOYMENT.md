# DigitalOcean VPS Deployment Guide

## Prerequisites
- DigitalOcean VPS (Ubuntu 20.04+ recommended)
- Domain name pointing to your VPS IP
- SSH access to your VPS

## Step 1: Server Setup

### Connect to your VPS
```bash
ssh root@your-vps-ip
```

### Update system packages
```bash
apt update && apt upgrade -y
```

### Install Node.js (using NodeSource repository)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

### Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### Install Nginx (Reverse Proxy)
```bash
apt install nginx -y
systemctl enable nginx
systemctl start nginx
```

## Step 2: Deploy Your Application

### Create application directory
```bash
mkdir -p /var/www/houseofreign
cd /var/www/houseofreign
```

### Upload your files to the VPS
You can use SCP, SFTP, or Git to upload your files:

```bash
# Using SCP (run from your local machine)
scp -r . root@your-vps-ip:/var/www/houseofreign/
```

### Install dependencies
```bash
cd /var/www/houseofreign
npm install --production
```

### Set up environment variables
```bash
cp env.example .env
nano .env
```

Update the `.env` file with your domain:
```
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
DB_PATH=./subscribers.db
```

## Step 3: Configure Nginx

### Create Nginx configuration
```bash
nano /etc/nginx/sites-available/houseofreign
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable the site
```bash
ln -s /etc/nginx/sites-available/houseofreign /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## Step 4: SSL Certificate (Let's Encrypt)

### Install Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### Get SSL certificate
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Step 5: Start Your Application

### Start with PM2
```bash
cd /var/www/houseofreign
pm2 start server.js --name "houseofreign"
pm2 save
pm2 startup
```

### Check status
```bash
pm2 status
pm2 logs houseofreign
```

## Step 6: Firewall Configuration

### Configure UFW
```bash
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable
```

## Step 7: Database Backup (Optional)

### Create backup script
```bash
nano /var/www/houseofreign/backup.sh
```

Add this content:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /var/www/houseofreign/subscribers.db /var/www/houseofreign/backups/subscribers_$DATE.db
find /var/www/houseofreign/backups/ -name "subscribers_*.db" -mtime +7 -delete
```

### Make it executable and set up cron
```bash
chmod +x /var/www/houseofreign/backup.sh
mkdir -p /var/www/houseofreign/backups
crontab -e
```

Add this line to run daily backups:
```
0 2 * * * /var/www/houseofreign/backup.sh
```

## Monitoring and Maintenance

### Check application status
```bash
pm2 status
pm2 logs houseofreign
```

### Restart application
```bash
pm2 restart houseofreign
```

### Update application
```bash
cd /var/www/houseofreign
git pull  # if using Git
npm install --production
pm2 restart houseofreign
```

## API Endpoints

Your application will have these endpoints:

- `GET /` - Frontend website
- `GET /api/health` - Health check
- `POST /api/subscribe` - Subscribe to notifications
- `GET /api/subscribers/count` - Get subscriber count
- `POST /api/unsubscribe` - Unsubscribe

## Security Notes

1. **Database**: SQLite database is stored in `/var/www/houseofreign/subscribers.db`
2. **Backups**: Set up regular database backups
3. **Updates**: Keep your system and dependencies updated
4. **Monitoring**: Monitor logs for any issues
5. **Rate Limiting**: Already configured to prevent abuse

## Troubleshooting

### Check if application is running
```bash
pm2 status
curl http://localhost:3000/api/health
```

### Check Nginx status
```bash
systemctl status nginx
nginx -t
```

### View logs
```bash
pm2 logs houseofreign
tail -f /var/log/nginx/error.log
```

### Restart services
```bash
pm2 restart houseofreign
systemctl restart nginx
```
