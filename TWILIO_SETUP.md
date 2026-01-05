# Twilio SMS Setup Instructions

This guide walks you through setting up SMS notifications so you receive a text message whenever someone places an order.

## What You'll Get

When a customer places an order, you'll receive a text like this:
```
New Order!
John Smith
(555) 123-4567
2x Classic Sourdough (Loaf), 1x Cinnamon Raisin (Half)
$28.00
Pickup: 2026-01-15
```

## Step 1: Create a Twilio Account

1. Go to [twilio.com](https://www.twilio.com/try-twilio)
2. Click **"Sign up and start building"**
3. Enter your email, name, and create a password
4. Verify your email address
5. Verify your phone number (Twilio will send you a code)

## Step 2: Get a Twilio Phone Number

1. After signing in, you'll be on the Twilio Console
2. Look for **"Get a Trial Number"** or go to Phone Numbers > Manage > Buy a Number
3. Click to get your free trial phone number
4. Note this number - this is your **TWILIO_PHONE_NUMBER** (format: +1XXXXXXXXXX)

## Step 3: Find Your Account Credentials

1. In the Twilio Console, look at the main dashboard
2. Find **Account SID** - this is your **TWILIO_ACCOUNT_SID**
   - Looks like: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. Find **Auth Token** - click "Show" to reveal it - this is your **TWILIO_AUTH_TOKEN**
   - Looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 4: Verify Your Phone Numbers (Trial Accounts Only)

During the trial period, you can only send SMS to verified phone numbers:

1. Go to Phone Numbers > Manage > Verified Caller IDs
2. Click **"Add a new Caller ID"**
3. Add each phone number that should receive notifications
4. Each person will receive a verification code to confirm

Note: After upgrading from trial (about $20), you can send to any phone number.

## Step 5: Send Sam These Values

Send the following four values to Sam securely:

1. **TWILIO_ACCOUNT_SID**: `AC...`
2. **TWILIO_AUTH_TOKEN**: `...` (keep this secret!)
3. **TWILIO_PHONE_NUMBER**: `+1...` (your Twilio number, not your personal number)
4. **OWNER_PHONE_NUMBERS**: Your phone numbers that should receive notifications
   - Format: `+15551234567` for one number
   - Format: `+15551234567,+15559876543` for multiple (comma-separated)

Sam will add these to the Vercel environment variables to complete the setup.

## Costs

**Trial Account (Free)**
- $15.50 credit to start
- Can only text verified numbers
- Good for testing

**After Trial**
- Phone number: ~$1.15/month
- Each SMS: ~$0.0079 (less than 1 cent)
- For 100 orders/month: ~$2/month total

## Testing

Once Sam confirms the setup is complete:
1. Place a test order on the order form
2. You should receive a text within seconds
3. If no text arrives, check that your phone is verified in Twilio

## Troubleshooting

**Not receiving texts?**
- Verify your phone number is added to Verified Caller IDs (trial accounts)
- Make sure the phone number format includes country code (+1 for US)
- Check Twilio Console > Messaging > Logs for error details

**Need to add/remove notification recipients?**
- Update the OWNER_PHONE_NUMBERS value with Sam's help
- Or do it in the desktop app Settings page (coming soon)

---

Questions? Contact Sam for help with the technical setup.
