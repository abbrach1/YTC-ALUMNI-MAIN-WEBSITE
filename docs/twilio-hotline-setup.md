# Twilio Hotline Setup Guide

## 1. Create a Twilio Account

- Go to [twilio.com](https://www.twilio.com)
- Sign up for a free account (includes $15 trial credit)
- Verify your email and phone number

## 2. Get Your Credentials

In your Twilio Console:
1. Copy your **Account SID** (starts with AC...)
2. Copy your **Auth Token** (keep this secret!)
3. Go to **Phone Numbers** → **Manage Numbers** → **Get a Number**
4. Choose a number (local or toll-free)
5. Note the number you selected

## 3. Add Environment Variables

Add these to your project's environment variables:

```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

## 4. Configure Webhook

In Twilio Console:
1. Go to **Phone Numbers** → **Active Numbers**
2. Click on your phone number
3. Under "Voice & Fax":
   - Set "A call comes in" to: `https://yourdomain.com/api/hotline/ivr`
   - Change method to POST
4. Save

Replace `yourdomain.com` with your actual Vercel domain

## 5. Test the Hotline

- Call your Twilio phone number
- You should hear the welcome menu
- Press 1, 2, or 3 to test different options

## Menu Structure

```
Main Menu:
├─ Press 1: Latest Shiur
├─ Press 2: Browse by Rebbe
└─ Press 3: Browse by Category
```

## Analytics

All calls are logged to Firebase `hotlineAnalytics` collection with:
- Call SID
- Menu selections
- Shiurim played
- Play count increments
- Timestamps

## Cost Considerations

- **Inbound calls**: $0.0075/min (US)
- **Free inbound SMS**: included
- **Pay-as-you-go pricing** (only pay for usage)
- Trial credit: $15 (typically covers ~2000 minutes)

## Troubleshooting

**No audio?**
- Check audio URLs are publicly accessible (Firebase Storage or similar)
- Test URL in browser to confirm

**Webhook not firing?**
- Verify webhook URL in Twilio console
- Check that your domain is publicly accessible
- Look at Twilio logs in console for errors

**Can't hear the menu?**
- Ensure Twilio credentials are set correctly
- Check browser console for errors in production
