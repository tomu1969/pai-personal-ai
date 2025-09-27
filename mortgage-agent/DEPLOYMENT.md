# Mortgage Agent Deployment Guide for Render.com

This guide provides step-by-step instructions for deploying the Mortgage Pre-Approval Chatbot to Render.com.

## Prerequisites

1. **GitHub Account**: Your code must be in a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **OpenAI API Key**: Required for LLM functionality

## Deployment Steps

### Step 1: Prepare Your Repository

1. Ensure all deployment files are present:
   ```
   mortgage-agent/
   ├── render.yaml          # Render blueprint configuration
   ├── Procfile            # Process startup command
   ├── runtime.txt         # Python version specification
   ├── requirements.txt    # Python dependencies
   ├── src/                # Application source code
   └── static/             # Static files (HTML interface)
   ```

2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

### Step 2: Deploy Using Render Blueprint (Recommended)

1. **Connect GitHub to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your GitHub account if not already connected
   - Select your repository

2. **Deploy from Blueprint**:
   - Render will automatically detect `render.yaml`
   - Review the configuration
   - Click "Apply" to create the service

### Step 3: Manual Deployment (Alternative)

If you prefer manual setup instead of using the blueprint:

1. **Create New Web Service**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service Settings**:
   - **Name**: `mortgage-agent`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn src.api:app --host 0.0.0.0 --port $PORT`

3. **Set Root Directory**:
   - Click "Advanced"
   - Set **Root Directory** to: `mortgage-agent`

### Step 4: Configure Environment Variables

In the Render dashboard, add these environment variables:

#### Required Variables:
| Variable | Value | Description |
|----------|--------|------------|
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key (keep secret) |
| `PORT` | `10000` | Render's default port |

#### Optional Company Configuration:
| Variable | Default Value | Description |
|----------|---------------|------------|
| `COMPANY_NAME` | `Premier Mortgage Services` | Your company name |
| `COMPANY_PHONE` | `1-800-MORTGAGE` | Contact phone |
| `COMPANY_EMAIL` | `info@premiermortgage.com` | Contact email |
| `LOAN_OFFICER_NAME` | `John Smith` | Loan officer name |
| `NMLS_NUMBER` | `123456` | NMLS license number |
| `LETTER_EXPIRY_DAYS` | `90` | Letter validity period |

### Step 5: Deploy the Service

1. Click "Create Web Service" or "Save Changes"
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Start the application
3. Monitor the deployment logs for any issues

### Step 6: Verify Deployment

Once deployed, test your endpoints:

1. **Health Check**:
   ```bash
   curl https://your-app.onrender.com/health
   ```
   Expected: `{"status": "healthy"}`

2. **Web Interface**:
   - Visit: `https://your-app.onrender.com`
   - You should see the chat interface

3. **API Documentation**:
   - Visit: `https://your-app.onrender.com/docs`
   - Interactive API documentation

4. **Test Chat Endpoint**:
   ```bash
   curl -X POST https://your-app.onrender.com/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   ```

## Deployment Configuration Files

### render.yaml
The blueprint file configures:
- Python runtime and version
- Build and start commands
- Environment variables
- Health check endpoint
- Auto-deploy settings
- Static file serving

### Procfile
Specifies the web process:
```
web: uvicorn src.api:app --host 0.0.0.0 --port $PORT
```

### runtime.txt
Specifies Python version:
```
python-3.11.0
```

## Monitoring & Logs

1. **View Logs**:
   - In Render dashboard, click on your service
   - Navigate to "Logs" tab
   - Monitor for errors or warnings

2. **Check Metrics**:
   - Navigate to "Metrics" tab
   - Monitor CPU, memory, and request metrics

3. **Set Up Alerts**:
   - Configure alerts for failures
   - Set up health check notifications

## Troubleshooting

### Common Issues and Solutions

1. **Build Fails**:
   - Check `requirements.txt` for typos
   - Ensure Python version compatibility
   - Review build logs for specific errors

2. **Service Won't Start**:
   - Verify `PORT` environment variable is set
   - Check start command in Procfile
   - Review application logs

3. **OpenAI API Errors**:
   - Verify `OPENAI_API_KEY` is set correctly
   - Check API key has sufficient credits
   - Ensure key has proper permissions

4. **Static Files Not Loading**:
   - Verify `static` directory exists
   - Check file paths in HTML
   - Ensure static files are committed to Git

5. **Health Check Failing**:
   - Verify `/health` endpoint exists
   - Check application is binding to `0.0.0.0`
   - Ensure correct PORT variable usage

## Updating the Application

1. **Automatic Deploys** (if enabled):
   - Push changes to main branch
   - Render automatically redeploys

2. **Manual Deploy**:
   - In Render dashboard, click "Manual Deploy"
   - Select "Deploy latest commit"

## Performance Optimization

1. **Upgrade Plan** for production:
   - Free tier: Limited resources
   - Starter: Better performance, custom domains
   - Standard/Pro: High availability, autoscaling

2. **Enable Caching**:
   - Use Redis for conversation state (future enhancement)
   - Cache static responses

3. **Monitor Response Times**:
   - Set up performance monitoring
   - Optimize slow endpoints

## Security Best Practices

1. **Environment Variables**:
   - Never commit API keys to Git
   - Use Render's secret management
   - Rotate keys regularly

2. **HTTPS**:
   - Render provides free SSL certificates
   - All traffic is encrypted by default

3. **Access Control**:
   - Consider adding authentication (future enhancement)
   - Implement rate limiting

## Cost Considerations

### Free Tier Limitations:
- 750 hours/month runtime
- Spins down after 15 minutes of inactivity
- Limited CPU and memory
- No custom domains

### Recommended for Production:
- **Starter Plan** ($7/month):
  - Always-on service
  - Custom domains
  - More resources
  - Better performance

## Support Resources

- **Render Documentation**: [docs.render.com](https://docs.render.com)
- **Render Community**: [community.render.com](https://community.render.com)
- **GitHub Issues**: Report bugs in your repository
- **OpenAI Support**: For API-related issues

## Next Steps

After successful deployment:

1. **Test thoroughly** with real mortgage scenarios
2. **Set up monitoring** and alerts
3. **Configure custom domain** (requires paid plan)
4. **Implement additional features**:
   - Email integration for sending letters
   - Database for persistent storage
   - User authentication
   - Analytics tracking
5. **Scale as needed** based on usage

## Rollback Procedure

If issues occur after deployment:

1. **Via Dashboard**:
   - Go to service → "Events" tab
   - Find previous successful deploy
   - Click "Rollback to this deploy"

2. **Via Git**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Contact

For deployment assistance or issues:
- Create an issue in the GitHub repository
- Contact Render support for platform-specific issues
- Review logs and metrics for debugging information