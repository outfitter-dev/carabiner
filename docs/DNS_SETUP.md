# DNS Setup for carabiner.outfitter.dev

## GitHub Pages Configuration

GitHub Pages is now configured to serve from the custom domain `carabiner.outfitter.dev`.

## DNS Configuration Required

To complete the setup, you need to configure DNS records in your domain provider (likely Cloudflare):

### Option 1: CNAME Record (Recommended for Subdomains)

Add this record in your DNS provider:

```
Type: CNAME
Name: carabiner
Target: outfitter-dev.github.io
Proxy: OFF (if using Cloudflare)
TTL: Auto
```

### Option 2: A Records (Alternative)

If CNAME doesn't work, use these A records pointing to GitHub Pages IPs:

```
Type: A
Name: carabiner
IP: 185.199.108.153

Type: A  
Name: carabiner
IP: 185.199.109.153

Type: A
Name: carabiner
IP: 185.199.110.153

Type: A
Name: carabiner
IP: 185.199.111.153
```

## GitHub Repository Settings

After DNS is configured:

1. Go to Settings → Pages in the repository
2. Under "Custom domain", it should show `carabiner.outfitter.dev`
3. Check "Enforce HTTPS" once DNS propagates
4. The site will be available at:
   - Main page: https://carabiner.outfitter.dev/
   - Schema: https://carabiner.outfitter.dev/schema.json

## Verification

Once DNS propagates (usually within 10-30 minutes):

```bash
# Test the schema endpoint
curl https://carabiner.outfitter.dev/schema.json

# Test DNS resolution
dig carabiner.outfitter.dev

# Test in a hook configuration
{
  "$schema": "https://carabiner.outfitter.dev/schema.json",
  "hooks": {
    // Your configuration
  }
}
```

## Troubleshooting

- **404 Error**: Make sure GitHub Pages is enabled and set to deploy from the `docs/` folder
- **SSL Error**: Wait for GitHub to provision the SSL certificate (can take up to 24 hours)
- **DNS Not Resolving**: Check DNS propagation with `dig` or online DNS checkers
- **Wrong Content**: Clear browser cache and try incognito/private mode

## Files Served

- `/` → `docs/index.html` (Landing page)
- `/schema.json` → `docs/schema.json` (Hook configuration schema)
- `/CNAME` → `docs/CNAME` (GitHub Pages domain configuration)