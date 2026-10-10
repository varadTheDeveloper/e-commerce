# Setting up SMS for login codes (DLT + MSG91)

Customers log in with a 6-digit code sent by SMS. In India every business SMS must be
registered on a **DLT** portal (a TRAI rule). Until this is done, the shop runs in **test
mode**: no SMS is sent and the code appears in the server log (development only).

Allow **1–3 weeks**: each approval below can take a few days.

## What the client needs
- Business PAN and GST certificate (or company/firm registration)
- An authorised person's ID proof and a letter of authorisation (templates on the portal)
- An email and mobile number for the DLT account

## Step 1: Register the business on a DLT portal
1. Choose one portal: **Jio TrueConnect** (often fastest), Vodafone Idea (Vilpower) or Airtel.
2. Sign up as **Principal Entity (PE)** / "Enterprise", upload the documents, pay the fee shown on the portal.
3. Wait for approval. You receive a **PE ID (Entity ID)**: write it down.

## Step 2: Register the sender name (header)
1. On the DLT portal, add a **Header** of type **Transactional/Service Implicit**.
2. 6 letters, related to the brand, for example `VASTRA` (it must not belong to someone else).
3. Wait for approval.

## Step 3: Register the login code message (content template)
1. Add a **Content Template**, category **Service Implicit**, type **OTP** if offered.
2. Use exactly this text (the variable `{#var#}` becomes the code):

   ```
   {#var#} is your login code for VASTRA. It is valid for 5 minutes. Do not share it with anyone.
   ```

3. Link it to your header. After approval you get a **DLT Template ID**.

## Step 4: Set up MSG91
1. Create an account at msg91.com and complete their KYC.
2. **Link DLT:** add your PE ID; under **SMS → Sender ID** add the header with its DLT ID.
3. **SMS → Templates → Create:** paste the same text, but write the variable as `##otp##`
   (MSG91's variable syntax), choose the sender ID, and enter the **DLT Template ID**.
   Copy MSG91's **Template ID** (not the DLT one).
4. **Authkey:** account menu → Authkey → create one. Treat it like a password.
5. Add a small balance; MSG91 charges per SMS.

## Step 5: Put the settings on the server (never in GitHub, never in chat)
In the backend's `.env` on the server, or AWS Secrets Manager:

```
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=<authkey from step 4>
MSG91_OTP_TEMPLATE_ID=<MSG91 template ID from step 4>
MSG91_OTP_VAR=otp
OTP_SECRET=<random, at least 32 characters, e.g. from: openssl rand -hex 32>
```

Leave `OTP_TEST_CODE` empty. In production the server refuses to start with
`SMS_PROVIDER=console` or a short `OTP_SECRET`.

## Step 6: Test
Log in on the shop with your own mobile number. The SMS should arrive within seconds.
If not, check MSG91's **Reports**: a DLT mismatch (text or header differs from the
approved template) is the most common reason.

Note: MSG91 also offers a dedicated "SendOTP" service. The shop uses their standard
template (Flow) API with its own code checks, which works with the template above.
