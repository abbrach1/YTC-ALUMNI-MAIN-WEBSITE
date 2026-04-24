# Email Integration with Resend

## Overview
The Yeshiva Toras Chaim alumni website now sends email notifications to the admin (abbrachfeld@gmail.com) whenever users submit forms or request access.

## Configuration

### Email Settings
- **API Key**: `re_WmehDzro_HR919LGzyvfVgE3e7isRjLsa`
- **From Email**: `ytcalumni@abbrachfeld.com`
- **Admin Email**: `abbrachfeld@gmail.com`

These are configured in `lib/resend.ts`.

## Email Triggers

### 1. Access Request
**When**: A new user signs up and requests access to the portal
**Trigger**: User clicks "Request Access" on `/request-access` page
**API Route**: `/api/send-access-request`
**Email Template**: `emails/access-request.tsx`

**Contains**:
- User's name
- User's email address

### 2. Simcha Submission
**When**: A user submits a simcha/event to share with the community
**Trigger**: User submits form on `/events` page
**API Route**: `/api/send-simcha-submission`
**Email Template**: `emails/simcha-submission.tsx`

**Contains**:
- Full name of person celebrating
- Type of simcha (wedding, bar mitzvah, etc.)
- Date of simcha
- Connection to Yeshiva
- Optional message
- Submitted by email

### 3. Contact Update
**When**: A user updates their contact information
**Trigger**: User submits form on `/contacts` page
**API Route**: `/api/send-contact-update`
**Email Template**: `emails/contact-update.tsx`

**Contains**:
- Full name
- Email address
- Phone number
- Address/City
- Graduation year (shown as "Class of XXXX")
- Additional notes

## File Structure

\`\`\`
lib/
  resend.ts                          # Resend configuration

emails/
  access-request.tsx                 # Access request email template
  simcha-submission.tsx              # Simcha submission email template
  contact-update.tsx                 # Contact update email template

app/
  api/
    send-access-request/
      route.ts                       # API route for access requests
    send-simcha-submission/
      route.ts                       # API route for simcha submissions
    send-contact-update/
      route.ts                       # API route for contact updates

  request-access/
    page.tsx                         # Updated to call email API
  events/
    page.tsx                         # Updated to call email API
  contacts/
    page.tsx                         # Updated to call email API
\`\`\`

## Email Templates

All email templates follow the Yeshiva brand:
- **Colors**: Navy (#0C1A35) and Gold (#C9A44E)
- **Font**: Georgia serif for headings
- **Layout**: Clean, professional design with Yeshiva branding

## Testing

To test the email integration:

1. **Access Request**:
   - Sign up with a new email
   - Click "Request Access" on the request access page
   - Check abbrachfeld@gmail.com for notification

2. **Simcha Submission**:
   - Go to `/events`
   - Fill out and submit the simcha form
   - Check abbrachfeld@gmail.com for notification

3. **Contact Update**:
   - Go to `/contacts`
   - Fill out and submit the contact update form
   - Check abbrachfeld@gmail.com for notification

## Next Steps

You can extend the email system by:
- Adding user confirmation emails (send to the user as well as admin)
- Creating templates for approval notifications
- Adding email notifications for approved access requests
- Sending weekly digests of new submissions
