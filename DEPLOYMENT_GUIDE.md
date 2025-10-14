# 🚀 Deployment Guide - HTTPS Setup

## 🔒 Why HTTPS is Required

Your application requires HTTPS because:
- **Supabase API** - Requires secure connections
- **TeamOffice API** - May require HTTPS for authentication
- **Browser Security** - Modern browsers block mixed content
- **User Trust** - "Not Secure" warnings scare users

## 🛠️ HTTPS Setup Options

### Option 1: Enable SSL on Your Hosting Provider

#### **cPanel/WHM Hosting:**
1. Login to cPanel
2. Find "SSL/TLS" or "Let's Encrypt" section
3. Enable SSL for your domain
4. Force HTTPS redirect (already configured in `.htaccess`)

#### **Cloudflare (Recommended):**
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Change nameservers to Cloudflare's
4. Enable "Always Use HTTPS" in SSL/TLS settings
5. Free SSL certificate automatically provided

#### **Other Hosting Providers:**
- **Hostinger** - Free SSL in hPanel
- **Bluehost** - Free SSL in cPanel
- **GoDaddy** - SSL certificates available
- **Namecheap** - Free SSL with hosting

### Option 2: Manual SSL Certificate

If your hosting provider doesn't offer free SSL:

1. **Get SSL Certificate:**
   - Let's Encrypt (free)
   - Cloudflare (free)
   - Commercial SSL providers

2. **Install Certificate:**
   - Upload certificate files to hosting
   - Configure web server to use HTTPS
   - Test HTTPS connection

## 📁 Deployment Steps

### 1. Build the Application
```bash
npm run build
```

### 2. Upload Files
Upload the entire `dist/` folder contents to your web hosting:
- `index.html`
- `assets/` folder
- `.htaccess` file

### 3. Configure Domain
- Point your domain to the hosting directory
- Ensure `.htaccess` is uploaded (it's hidden by default)

### 4. Enable HTTPS
Follow one of the HTTPS setup options above.

### 5. Test Deployment
1. Visit your domain with `https://`
2. Check browser shows "Secure" lock icon
3. Test all application features

## 🔧 Troubleshooting

### "Not Secure" Still Shows
1. **Clear browser cache** - Hard refresh (Ctrl+F5)
2. **Check .htaccess** - Ensure it's uploaded correctly
3. **Wait for propagation** - DNS changes can take 24-48 hours
4. **Test different browsers** - Some cache more aggressively

### JavaScript Module Script Errors
**Error:** "Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of 'text/html'"

**Solutions:**
1. **Use compatible .htaccess** - Rename `.htaccess-compatible` to `.htaccess`
2. **Check MIME types** - Ensure server serves `.js` files as `application/javascript`
3. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)
4. **Check file permissions** - Ensure `.htaccess` is readable by web server
5. **Test direct JS file** - Visit `https://yoursite.com/assets/index-xxx.js` directly

**Quick Fix:**
```bash
# Replace .htaccess with compatible version
mv .htaccess-compatible .htaccess
```

### Mixed Content Errors
- Ensure all API calls use HTTPS
- Check that images and resources load over HTTPS
- Update any hardcoded HTTP URLs

### Supabase Connection Issues
- Verify `VITE_SUPABASE_URL` uses `https://`
- Check Supabase project settings allow your domain
- Ensure CORS is configured correctly

## ✅ Verification Checklist

- [ ] Site loads with `https://` prefix
- [ ] Browser shows "Secure" lock icon
- [ ] No "Not Secure" warnings
- [ ] All API calls work correctly
- [ ] Authentication works
- [ ] Attendance sync functions
- [ ] No console errors

## 🆘 Need Help?

If you're still having issues:

1. **Check hosting provider documentation** for SSL setup
2. **Contact hosting support** for SSL assistance
3. **Use Cloudflare** - Easiest free SSL solution
4. **Test with different hosting** - Some providers have better SSL support

## 🎯 Quick Fix with Cloudflare

1. Go to [cloudflare.com](https://cloudflare.com)
2. Add your domain (free)
3. Change nameservers at your domain registrar
4. Wait for DNS propagation (up to 24 hours)
5. Enable "Always Use HTTPS" in Cloudflare dashboard
6. Your site will automatically redirect to HTTPS

This is the easiest and most reliable way to get HTTPS working!
