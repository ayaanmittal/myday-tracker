# 🚀 CyberPanel Deployment Guide for MyDay Tracker

Complete step-by-step guide to deploy your React + Node.js application on VPS with CyberPanel.

## 🎯 Quick Start Summary

If you're experienced with server deployments, here's the condensed version:

1. **Setup**: Install Node.js 18+ and PM2
2. **CyberPanel**: Create website via CyberPanel dashboard
3. **Deploy**: Clone repo → `npm install` → `npm run build` → Copy `dist/*` to `/home/domain/public_html`
4. **Backend**: Create `.env` → Configure PM2 → `pm2 start ecosystem.config.js`
5. **Proxy**: Configure Apache reverse proxy for `/api` and `/socket.io`
6. **SSL**: Issue Let's Encrypt certificate in CyberPanel
7. **Done**: Your app is live!

**For detailed instructions, continue reading below.**

---

## 📋 Prerequisites

- **VPS Server** with root/SSH access
- **CyberPanel** installed on your VPS
- **Domain name** pointed to your VPS IP
- **Node.js 18+** (will install if not present)
- **PM2** (process manager for Node.js)

---

## 📦 Part 1: Server Setup

### Step 1: Connect to Your VPS

```bash
ssh root@your-server-ip
# or
ssh your-username@your-server-ip
```

### Step 2: Install Node.js (if not installed)

```bash
# Update system packages
yum update -y  # For CentOS/RHEL
# OR
apt update && apt upgrade -y  # For Ubuntu/Debian

# Install Node.js using NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -  # For CentOS/RHEL
# OR
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -  # For Ubuntu/Debian

# Install Node.js
yum install -y nodejs  # For CentOS/RHEL
# OR
apt install -y nodejs  # For Ubuntu/Debian

# Verify installation
node --version  # Should be 18.x or higher
npm --version
```

### Step 3: Install PM2 (Process Manager)

```bash
npm install -g pm2
```

---

## 🌐 Part 2: CyberPanel Setup

### Step 1: Create Website in CyberPanel

1. **Login to CyberPanel**
   - Access: `https://your-server-ip:8090` or `https://your-domain:8090`
   - Use your admin credentials

2. **Create Website**
   - Go to **Websites → Create Website**
   - Enter your domain name (e.g., `mydomain.com`)
   - Choose PHP version (doesn't matter for Node.js, but select latest)
   - Click **Create Website**

3. **Note the Website Directory**
   - CyberPanel creates: `/home/your-domain/public_html`
   - This is where your frontend files will go

### Step 2: Configure DNS

Point your domain to your VPS:
- Create an **A Record**: `@` pointing to your VPS IP
- Create a **CNAME Record**: `www` pointing to `@` (optional)

Wait for DNS propagation (5 minutes to 48 hours).

---

## 📥 Part 3: Upload Application

### Option A: Using Git (Recommended)

```bash
# Navigate to a temporary directory
cd /root
# OR
cd ~

# Clone your repository
git clone YOUR_REPO_URL myday-tracker
cd myday-tracker

# Install dependencies
npm install
```

### Option B: Using FTP/SFTP

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Upload via SFTP**:
   - Upload entire `dist/` folder contents to `/home/your-domain/public_html`
   - Upload `.htaccess` from `public/` to `/home/your-domain/public_html`

### Option C: Direct Upload via CyberPanel File Manager

1. In CyberPanel, go to **File Manager**
2. Navigate to `/home/your-domain/public_html`
3. Upload your built files

---

## 🔧 Part 4: Build and Configure Frontend

### Step 1: Build the Application

```bash
cd /root/myday-tracker  # or wherever you cloned/uploaded

# Install dependencies
npm install

# Create production build
npm run build
```

### Step 2: Copy Files to Website Directory

```bash
# Copy build files
cp -r dist/* /home/your-domain/public_html/

# Copy .htaccess file
cp public/.htaccess /home/your-domain/public_html/.htaccess

# Set correct permissions
chown -R your-domain:your-domain /home/your-domain/public_html
chmod -R 755 /home/your-domain/public_html
```

### Step 3: Create Environment File for Frontend

```bash
# Create .env file for build-time variables (if needed)
nano /root/myday-tracker/.env
```

Add your environment variables (see Part 6 for complete list).

**Note**: For Vite, variables must be prefixed with `VITE_` to be included in the build.

---

## 🖥️ Part 5: Configure Node.js Backend

### Step 1: Install Project Dependencies

```bash
cd /root/myday-tracker
npm install
```

**Note**: We need all dependencies (including dev dependencies) because `tsx` is required to run TypeScript files.

### Step 2: Create Environment File

```bash
nano /root/myday-tracker/.env
```

Add all required environment variables (see Part 6).

### Step 3: Create PM2 Ecosystem File

The `ecosystem.config.js` file should already be in your repository. If not, create it:

```bash
# If file doesn't exist, create it
nano /root/myday-tracker/ecosystem.config.js
```

The file content is already provided in your repository. It configures PM2 to:
- Run your TypeScript server using `tsx`
- Auto-restart on crashes
- Log errors and output
- Limit memory usage

### Step 4: Start Backend with PM2

```bash
cd /root/myday-tracker

# Start the server
pm2 start ecosystem.config.js

# Save PM2 configuration (survives reboots)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions it provides
```

### Step 5: Verify Backend is Running

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs myday-tracker-server

# Test backend endpoint
curl http://localhost:3000/health
```

---

## 🔐 Part 6: Environment Variables

Copy the example file and edit it:

```bash
cp .env.example .env
nano .env
```

Or create `/root/myday-tracker/.env` manually with all required variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
VITE_CLIENT_URL=https://your-domain.com

# Supabase Configuration (REQUIRED)
# Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# TeamOffice API Configuration (Optional - only if using biometric integration)
TEAMOFFICE_BASE=https://api.etimeoffice.com/api
TEAMOFFICE_CORP_ID=your-corp-id
TEAMOFFICE_USERNAME=your-username
TEAMOFFICE_PASSWORD=your-password
TEAMOFFICE_TRUE_LITERAL=true
TEAMOFFICE_EMPCODE=ALL

# Sync Configuration
SYNC_INTERVAL_MINUTES=3
TIMEZONE=Asia/Kolkata

# Socket.io Configuration
VITE_SOCKET_URL=https://your-domain.com
```

**⚠️ Important Note**: Your `src/integrations/supabase/client.ts` file currently has hardcoded Supabase values. For production:
- **Option A**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` match the hardcoded values (or rebuild frontend if they differ)
- **Option B**: Update `client.ts` to use environment variables (recommended for flexibility)

### Build-time Variables (for frontend)

Since Vite requires variables at build time, you have two options:

**Option 1: Include in build** (rebuild after env changes):
```bash
# Add VITE_ prefix to variables that frontend needs
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
VITE_SOCKET_URL=https://your-domain.com
VITE_TEAMOFFICE_BASE=https://api.etimeoffice.com/api
# ... etc

# Then rebuild
npm run build
cp -r dist/* /home/your-domain/public_html/
```

**Option 2: Runtime Configuration** (More flexible):
Create a `config.js` file that's loaded at runtime. See "Advanced: Runtime Config" section below.

### Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **anon/public key** → Use for `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (backend only - never expose in frontend!)

---

## 🔄 Part 7: Proxy Configuration

Since your frontend is served by Apache and backend runs on Node.js, you need to proxy API/Socket requests.

### Method 1: Apache Reverse Proxy (Recommended for CyberPanel)

Edit your Apache virtual host:

```bash
nano /etc/apache2/conf.d/your-domain-vhost.conf
# OR for CentOS/RHEL:
nano /etc/httpd/conf/httpd-vhosts.conf
```

Or use CyberPanel:
1. Go to **Websites → List Websites**
2. Click **Manage** next to your domain
3. Click **Apache Config**

Add these lines **before** `</VirtualHost>`:

```apache
# Enable required Apache modules (if not already enabled)
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so

<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /home/your-domain/public_html
    
    # Proxy API requests to Node.js backend
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api
    
    # Proxy Socket.io requests
    ProxyPass /socket.io http://localhost:3000/socket.io
    ProxyPassReverse /socket.io http://localhost:3000/socket.io
    
    # WebSocket support for Socket.io
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /socket.io/(.*) ws://localhost:3000/socket.io/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /socket.io/(.*) http://localhost:3000/socket.io/$1 [P,L]
    
    # Allow .htaccess overrides
    <Directory /home/your-domain/public_html>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Then restart Apache:
```bash
systemctl restart httpd  # For CentOS/RHEL
# OR
systemctl restart apache2  # For Ubuntu/Debian
```

### Method 2: Using CyberPanel's Built-in Features

1. Go to **Websites → List Websites**
2. Click **Manage** for your domain
3. Use **Apache Config** or **Nginx Config** (if using OpenLiteSpeed/LiteSpeed)
4. Add the proxy configuration as shown above

---

## 🔒 Part 8: SSL Certificate Setup

### Step 1: Issue SSL Certificate in CyberPanel

1. Go to **SSL → Issue SSL**
2. Select your domain
3. Choose **Let's Encrypt** (free)
4. Click **Issue SSL**

### Step 2: Force HTTPS

Your `.htaccess` file should already have HTTPS redirect. Verify:

```bash
cat /home/your-domain/public_html/.htaccess | grep -i https
```

If needed, uncomment the HTTPS redirect in `.htaccess`:
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Step 3: Update Environment Variables

After enabling HTTPS, update:
```env
VITE_CLIENT_URL=https://your-domain.com
VITE_SOCKET_URL=https://your-domain.com
```

Rebuild frontend if these are build-time variables.

---

## 🧪 Part 9: Testing Deployment

### Step 1: Test Frontend

```bash
# Visit your domain
curl https://your-domain.com

# Should return HTML content
```

Open in browser: `https://your-domain.com`

### Step 2: Test Backend API

```bash
# Test health endpoint
curl https://your-domain.com/api/health
# OR if not proxied:
curl http://localhost:3000/health
```

### Step 3: Test Socket.io

Open browser console and check for Socket.io connection.

### Step 4: Check Logs

```bash
# PM2 logs
pm2 logs myday-tracker-server

# Apache error logs
tail -f /usr/local/lsws/logs/error.log  # For LiteSpeed
# OR
tail -f /var/log/apache2/error.log  # For Apache

# Application logs
tail -f /var/log/myday-tracker-*.log
```

---

## 🔄 Part 10: Auto-Start and Maintenance

### PM2 Auto-Start (Already configured)

If you followed Part 5, PM2 should auto-start. Verify:

```bash
# Check if PM2 startup script is installed
pm2 startup systemd

# Manually save PM2 process list
pm2 save
```

### Useful PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs myday-tracker-server

# Restart application
pm2 restart myday-tracker-server

# Stop application
pm2 stop myday-tracker-server

# Delete application from PM2
pm2 delete myday-tracker-server

# Monitor resources
pm2 monit
```

### Updating Application

```bash
cd /root/myday-tracker

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild frontend
npm run build

# Copy to website directory
cp -r dist/* /home/your-domain/public_html/

# Restart backend
pm2 restart myday-tracker-server
```

---

## 🛠️ Troubleshooting

### Issue: Frontend not loading

**Check:**
1. Files are in correct directory: `/home/your-domain/public_html/`
2. Permissions: `chmod -R 755 /home/your-domain/public_html`
3. `.htaccess` is present and readable
4. Apache/LiteSpeed is running: `systemctl status httpd`

### Issue: Backend not responding

**Check:**
1. PM2 status: `pm2 status`
2. Backend logs: `pm2 logs myday-tracker-server`
3. Port is not blocked: `netstat -tulpn | grep 3000`
4. Environment variables are set correctly
5. Node.js version: `node --version`

### Issue: Socket.io not connecting

**Check:**
1. Proxy configuration is correct
2. WebSocket support is enabled in Apache
3. Firewall allows WebSocket connections
4. Check browser console for errors
5. Verify `VITE_SOCKET_URL` in environment

### Issue: CORS Errors

**Check:**
1. `VITE_CLIENT_URL` matches your domain exactly
2. Supabase CORS settings include your domain
3. Apache headers are configured correctly

### Issue: 502 Bad Gateway

**Check:**
1. Backend is running: `pm2 status`
2. Backend is listening on correct port
3. Proxy configuration points to correct backend URL
4. Firewall settings

### Issue: SSL Certificate Errors

**Check:**
1. DNS is correctly pointing to your server
2. Port 443 is open in firewall
3. SSL certificate is issued in CyberPanel
4. Certificate is not expired

### Common Commands

```bash
# Check if backend is running
pm2 status
curl http://localhost:3000/health

# Check Apache/Apache status
systemctl status httpd  # CentOS/RHEL
systemctl status apache2  # Ubuntu/Debian

# Check open ports
netstat -tulpn | grep -E '80|443|3000'

# Check disk space
df -h

# Check system resources
top
# OR
htop  # if installed
```

---

## 🔥 Firewall Configuration

### Open Required Ports

```bash
# For CentOS/RHEL (firewalld)
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload

# For Ubuntu/Debian (ufw)
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw reload

# Check firewall status
firewall-cmd --list-all  # CentOS/RHEL
ufw status  # Ubuntu/Debian
```

---

## 📊 Monitoring and Maintenance

### Set up Log Rotation

```bash
nano /etc/logrotate.d/myday-tracker
```

Add:
```
/var/log/myday-tracker-*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

### Monitor Disk Space

```bash
# Set up cron job for disk space alerts
crontab -e

# Add:
0 0 * * * df -h | mail -s "Disk Usage Report" your-email@example.com
```

### Performance Monitoring

```bash
# Install monitoring tools
npm install -g pm2-logrotate

# Configure PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🔐 Security Best Practices

1. **Keep Node.js updated**
   ```bash
   npm install -g npm@latest
   ```

2. **Keep system updated**
   ```bash
   yum update -y  # CentOS/RHEL
   apt update && apt upgrade -y  # Ubuntu/Debian
   ```

3. **Secure .env file**
   ```bash
   chmod 600 /root/myday-tracker/.env
   chown root:root /root/myday-tracker/.env
   ```

4. **Regular backups**
   - Backup database (Supabase dashboard)
   - Backup application files
   - Backup PM2 configuration: `pm2 save`

5. **Fail2Ban setup** (optional but recommended)
   ```bash
   yum install fail2ban  # CentOS/RHEL
   apt install fail2ban  # Ubuntu/Debian
   systemctl enable fail2ban
   systemctl start fail2ban
   ```

---

## 📝 Quick Reference Checklist

- [ ] VPS with CyberPanel installed
- [ ] Domain pointed to VPS IP
- [ ] Node.js 18+ installed
- [ ] PM2 installed and configured
- [ ] Application cloned/uploaded
- [ ] Dependencies installed (`npm install`)
- [ ] Frontend built (`npm run build`)
- [ ] Files copied to `/home/your-domain/public_html`
- [ ] `.env` file created with all variables
- [ ] Backend started with PM2
- [ ] Apache proxy configured
- [ ] SSL certificate issued
- [ ] Firewall ports opened
- [ ] Application tested
- [ ] Logs monitored

---

## 🆘 Getting Help

If you encounter issues:

1. **Check logs first**:
   - PM2 logs: `pm2 logs myday-tracker-server`
   - Apache logs: `/var/log/apache2/error.log` or CyberPanel logs
   - Application logs: `/var/log/myday-tracker-*.log`

2. **Verify configurations**:
   - Environment variables are correct
   - Ports are open
   - Services are running

3. **Test individually**:
   - Test backend: `curl http://localhost:3000/health`
   - Test frontend: `curl https://your-domain.com`
   - Test proxy: `curl https://your-domain.com/api/health`

---

## 📚 Additional Resources

- [CyberPanel Documentation](https://cyberpanel.net/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Apache Reverse Proxy Guide](https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

**🎉 Congratulations! Your application should now be live at `https://your-domain.com`**

