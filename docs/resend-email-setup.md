# Resend Email Integration

This document explains how the Yeshiva Toras Chaim alumni website uses Resend for email notifications.

## Overview

The website sends automated email notifications to the admin (abbrachfeld@gmail.com) when:
- A user requests access to the alumni portal
- A user submits a simcha/event
- A user submits a contact information update

## Email Configuration

- **Resend API Key**: `re_WmehDzro_HR919LGzyvfVgE3e7isRjLsa`
- **From Email**: `ytcalumni@abbrachfeld.com`
- **To Email (Admin)**: `abbrachfeld@gmail.com`

## Email Types

### 1. Access Request Email
Sent when a new user requests access to the alumni portal.

**Template**: `emails/access-request.tsx`
**API Route**: `POST /api/send-access-request`

Contains:
- User's name and email
- Request date and time
- Direct link to approve the request in admin dashboard

### 2. Simcha Submission Email
Sent when a user submits a simcha or event.

**Template**: `emails/simcha-submission.tsx`
**API Route**: `POST /api/send-simcha-submission`

Contains:
- Event type and date
- Family name and details
- Full description
- Direct link to manage events in admin dashboard

### 3. Contact Update Email
Sent when a user requests to update their contact information.

**Template**: `emails/contact-update.tsx`
**API Route**: `POST /api/send-contact-update`

Contains:
- Update type (Rebbe or Alumni)
- Contact name and details
- All submitted information
- Direct link to manage contacts in admin dashboard

## Email Templates

All email templates follow a consistent design:
- **Colors**: Navy blue (#0C1A35) header, gold (#C9A44E) accents
- **Logo**: Yeshiva Toras Chaim logo in header
- **Responsive**: Mobile-friendly HTML emails
- **Professional**: Clean, dignified layout matching the site

## API Routes

### Send Access Request
\`\`\`typescript
POST /api/send-access-request
Body: {
  name: string,
  email: string,
  message?: string
}
\`\`\`

### Send Simcha Submission
\`\`\`typescript
POST /api/send-simcha-submission
Body: {
  eventType: string,
  familyName: string,
  eventDate: string,
  description: string,
  contactEmail: string
}
\`\`\`

### Send Contact Update
\`\`\`typescript
POST /api/send-contact-update
Body: {
  type: "rebbe" | "alumni",
  name: string,
  email: string,
  phone?: string,
  location?: string,
  // other contact fields
}
\`\`\`

## Troubleshooting

### Emails Not Sending
- Verify Resend API key is correct
- Check that "From" email domain is verified in Resend
- Review Resend dashboard logs for errors

### Emails Going to Spam
- Ensure sender domain has proper SPF/DKIM records
- Add admin email to contacts
- Check email content for spam triggers

### Wrong Recipient
- Verify `ADMIN_EMAIL` is set correctly in email API routes
- Check that email templates use correct recipient

## Future Enhancements

- Add email notifications to users when their requests are approved
- Send weekly digest of new shiurim to subscribers
- Implement email preferences for users
- Add unsubscribe functionality
