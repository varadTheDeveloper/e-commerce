# EC2 server setup (test copy of the shop)

How to put the shop on one small AWS server, for testing and client demos. Same approach as the Lexauraa
server (Docker, Caddy for HTTPS, secrets only in `/opt/shop/*.env`). No secrets are in this file or in the repo.

## What runs where

| Part | Where |
| --- | --- |
| Server | AWS EC2, Mumbai (`ap-south-1`), Ubuntu 24.04, x86_64, **t3.micro** (2 vCPU, 1 GB RAM) + 4 GB swap, 50 GB gp3 disk |
| Addresses | Elastic IP; two DNS records: the website (`SHOP_DOMAIN`, e.g. `shop-test.example.in`) and the API + staff admin (`API_DOMAIN`, e.g. `api.shop-test.example.in`) |
| Containers (`deploy/docker-compose.yml`) | `caddy` (ports 80/443, HTTPS) → `storefront` (Next.js) and `backend` (Medusa: API, admin at `/app`, background jobs) → `db` (Postgres 16) and `redis` (Redis 7), both on an internal network with no internet and no open ports |
| Images | built by GitHub Actions (`.github/workflows/images.yml`) and pulled from GitHub Packages: the 1 GB server never builds |
| Secrets | `/opt/shop/db.env`, `/opt/shop/backend.env`, `/opt/shop/storefront.env`, `/opt/shop/caddy.env`, all chmod 600 |
| Demo password | `/opt/shop/demo-auth.caddy`: the whole website asks for a username and password (search engines stay out) |
| Uploaded photos | on the server's disk (Docker volume `uploads`), or S3 (section 8) |
| Backups | `/opt/shop/backups` (chmod 700), nightly 01:30 IST, newest 14 kept |

## Test mode (what "test copy" means)

`NODE_ENV=staging` in `backend.env`. Production mode refuses to start until every real key exists (Razorpay,
Shiprocket, Message Central, Resend). Don't use `development` on the server: Medusa then tries to start its admin
development server, which the image doesn't contain, and the backend restarts in a loop.

| Part | In test mode |
| --- | --- |
| Phone login | **every number logs in with code `123456`** (`SMS_PROVIDER=console`, `OTP_TEST_CODE`). This is why the demo password exists. |
| Online payment | Razorpay **test** keys (Razorpay dashboard → Test mode → API keys; no KYC needed) |
| Delivery | no Shiprocket keys: every pincode is accepted, and staff can't book couriers |
| Emails | written to the backend log only (until `RESEND_API_KEY` and a verified domain) |
| Catalogue | the demo catalogue (same as development) |

## How much it handles (t3.micro)

Measured on 14 October 2026, on a copy of this setup run on one CPU core (not yet on the real server):

| Visitors browsing at once | Pages per second | Typical page | Slowest 3 % |
| --- | --- | --- | --- |
| 5 | 15.7 | 0.26 s | 0.68 s |
| 10 | 17.9 | 0.55 s | 0.77 s |
| 20 | 17.5 | 1.09 s | 1.64 s |

Measured on the real server (`shop.lexauraa.in`, 14 October 2026), from a test computer outside India
(about 0.25 s network delay each way included), home page in Marathi:

| Visitors browsing at once | Pages per second | Typical page | Slowest 3 % | Errors |
| --- | --- | --- | --- | --- |
| 5 | 9.6 | 0.48 s | 2.1 s | 0 |
| 10 | 12.2 | 0.78 s | 2.1 s | 0 |
| 20 | 16.2 | 1.21 s | 2.4 s | 0 |

After the test: no restarts, about 750 MB memory used plus 300 MB swap.

- **Memory, quiet:** about 414 MB backend + 122 MB website + about 100 MB Postgres.
- **Memory under load:** about 450 + 280 MB. A t3.micro will use swap when busy.
- **CPU limit:** a t3.micro gets full CPU speed only in short bursts (CPU credits). With the default "unlimited"
  setting, AWS charges a little extra instead of slowing down. Watch EC2 → the instance → Monitoring → CPU credit
  balance.
- **Fine for:** testing and client demos (a few people at a time).
- **Not for real customers:** change to a t3.medium (4 GB) or larger first:
  1. Stop the instance.
  2. Actions → Instance settings → Change instance type.
  3. Start it.

  Nothing needs rebuilding.
- The real numbers on the server get measured after setup (step 9).

## Set up the server, step by step

### 1. Machine (AWS console)
- EC2 → Launch instance:
  - Ubuntu Server 24.04 LTS (x86), type **t3.micro**, region Mumbai.
  - Storage **50 GB gp3**.
  - Key pair: none needed. You log in with the console's "Connect" button.
- Security group, inbound:
  - HTTP 80 and HTTPS 443 from `0.0.0.0/0`.
  - SSH 22 **only** from the prefix list `com.amazonaws.ap-south-1.ec2-instance-connect`, so the "Connect" button works.
  - Never open 5432, 6379, 8000 or 9000.
- Instance → Actions → Instance settings → **Modify instance metadata options**: IMDSv2 required, **hop limit 2**.
  Containers need hop limit 2 to use the server's IAM role for S3 (section 8).
- EC2 → Elastic IPs → Allocate → Associate with the instance.

Then log in (Connect → EC2 Instance Connect) and run:
```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo apt update && sudo apt upgrade
sudo apt install unattended-upgrades     # automatic security updates
sudo reboot                              # if /var/run/reboot-required exists
```

### 2. Docker and the deploy files
1. Install Docker Engine and the Compose plugin from Docker's apt repository
   (<https://docs.docker.com/engine/install/ubuntu/>): `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`,
   plus `git`.
2. The repository is public, so no deploy key is needed:
   ```bash
   sudo mkdir -p /opt/shop && sudo chown ubuntu:ubuntu /opt/shop && chmod 750 /opt/shop
   git clone https://github.com/varadTheDeveloper/e-commerce.git /opt/shop/app
   ```
3. GitHub Packages: the first time the images are built (step 6), open GitHub → your profile → Packages →
   `e-commerce-backend` and `e-commerce-storefront` → Package settings → Change visibility → **Public**.
   This lets the server pull them without a login. The images hold no secrets: only public code and the
   publishable key, which is public by design.

### 3. Secrets and settings
Pick the two addresses first (they must be real DNS names you control). Then create the files with random values;
the commands never show them:
```bash
SHOP=shop-test.example.in        # the website
API=api.shop-test.example.in     # API + staff admin
umask 077
PGPW=$(openssl rand -hex 32)
printf 'POSTGRES_USER=shop\nPOSTGRES_DB=shop\nPOSTGRES_PASSWORD=%s\n' "$PGPW" > /opt/shop/db.env
cat > /opt/shop/backend.env <<EOF
NODE_ENV=staging
DATABASE_URL=postgres://shop:$PGPW@db:5432/shop?sslmode=disable
REDIS_URL=redis://redis:6379
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
OTP_SECRET=$(openssl rand -hex 32)
STORE_CORS=https://$SHOP
ADMIN_CORS=https://$API
AUTH_CORS=https://$API,https://$SHOP
STOREFRONT_URL=https://$SHOP
FILE_BASE_URL=https://$API/static
SMS_PROVIDER=console
OTP_TEST_CODE=123456
MEDUSA_DISABLE_TELEMETRY=true
EOF
printf 'NEXT_PUBLIC_DEFAULT_REGION=in\n' > /opt/shop/storefront.env
printf 'SHOP_DOMAIN=%s\nAPI_DOMAIN=%s\n' "$SHOP" "$API" > /opt/shop/caddy.env
unset PGPW
```
`sslmode=disable` is needed: Medusa tries SSL for every database address except `localhost`, and the Postgres
container has no SSL, so without it the backend waits and fails with "Could not connect to the database while
running migrations". The database is only reachable on Docker's internal network.

Demo password for the website (username `demo`; the password is typed, not shown, and only its hash is saved):
```bash
read -rsp "Demo password: " PW; echo
HASH=$(sudo docker run --rm caddy:2 caddy hash-password --plaintext "$PW"); unset PW
printf 'basic_auth {\n\tdemo %s\n}\n' "$HASH" > /opt/shop/demo-auth.caddy && chmod 600 /opt/shop/demo-auth.caddy
```
(For the real launch: `: > /opt/shop/demo-auth.caddy` empties it, which turns the password off.)

Add each key without it showing on screen (never paste keys into chat or Git):
```bash
sudo /opt/shop/app/deploy/set-secret.sh RAZORPAY_KEY_ID          # test key: rzp_test_...
sudo /opt/shop/app/deploy/set-secret.sh RAZORPAY_KEY_SECRET
sudo /opt/shop/app/deploy/set-secret.sh RAZORPAY_WEBHOOK_SECRET  # any long random text; the same in Razorpay's webhook settings
```
The other keys (Shiprocket, Resend, Message Central) come when the client's accounts are ready: see
`docs/SETUP-PAYMENTS.md`, `docs/SETUP-SHIPPING.md` and `docs/SETUP-SMS.md`.

### 4. Domain (DNS)
Two A records pointing at the Elastic IP, TTL 300: `SHOP_DOMAIN` and `API_DOMAIN`. Caddy gets both HTTPS
certificates by itself once the records point at the server.

### 5. Start the backend and fill the shop
```bash
cd /opt/shop/app/deploy
sudo docker compose pull db redis backend caddy
sudo docker compose up -d db redis backend caddy        # migrations run when the backend starts
sudo docker compose ps                                  # db, redis, backend "healthy" (the first start takes 1–2 minutes)
curl https://$API/health                                # OK
sudo docker compose exec backend ./node_modules/.bin/medusa exec ./src/scripts/seed.js      # demo catalogue (once)
sudo docker compose exec db sh -c 'psql -U shop -d shop -tAc "select token from api_key where type = '"'publishable'"'"'
```
The last command prints the **publishable key** (`pk_...`). It is public by design: the website sends it with
every request.

First staff account (the password is typed, not shown):
```bash
read -rsp "New staff password: " PW; echo
sudo docker compose exec backend ./node_modules/.bin/medusa user -e you@example.com -p "$PW"; unset PW
```
The staff admin is at `https://$API/app`.

### 6. Build and start the website
1. GitHub → the repository → Settings → Secrets and variables → Actions → **Variables** → add:

   | Variable | Value |
   | --- | --- |
   | `SHOP_BASE_URL` | `https://<SHOP_DOMAIN>` |
   | `SHOP_API_URL` | `https://<API_DOMAIN>` |
   | `SHOP_PUBLISHABLE_KEY` | the `pk_...` from step 5 |
   | `SHOP_IMAGE_HOSTS` | `<API_DOMAIN>` (and the S3 bucket's host after section 8) |

2. Actions → **Server images** → Run workflow. It builds both images, about 10 minutes.
3. On the server:
   ```bash
   cd /opt/shop/app/deploy
   sudo docker compose pull storefront && sudo docker compose up -d
   ```
4. Open `https://<SHOP_DOMAIN>`. It asks for the demo password, then shows the shop.

After that, every change merged into `main` builds new images by itself (after CI passes). To put them on the
server:
```bash
cd /opt/shop/app/deploy && git -C /opt/shop/app pull && sudo docker compose pull && sudo docker compose up -d
```

### 7. Backups
```bash
sudo cp /opt/shop/app/deploy/systemd/shop-backup.* /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now shop-backup.timer
sudo systemctl start shop-backup.service                         # one backup now
sudo /opt/shop/app/deploy/restore.sh /opt/shop/backups/<file>.sql.gz   # into a NEW database, never over the live one
```
The backups are on the same disk and hold the database only (not uploaded photos). Also:
- Turn on **daily EBS snapshots** (EC2 → Lifecycle Manager, policy on the instance's tag, daily, keep 7).
- Copies to S3 (optional): install the AWS CLI (`sudo snap install aws-cli --classic`), give the server's IAM role
  `s3:PutObject` on a private bucket, and put `BACKUP_S3_BUCKET=<bucket>` in `/opt/shop/backup.env`.

### 8. Photos on S3 (optional for the test copy)
1. S3 → Create bucket in `ap-south-1`. Object Ownership: "Bucket owner enforced".
2. Allow public reading of uploaded photos only: untick "Block all public access" (keep the two ACL options
   blocked), and add this bucket policy:
   ```json
   { "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
     "Resource": "arn:aws:s3:::<bucket>/*" } ] }
   ```
3. IAM → Roles → Create role for EC2:
   - Permissions: `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`.
   - Attach the role to the instance: Actions → Security → Modify IAM role.

   No access keys are needed or stored.
4. In `/opt/shop/backend.env`: `S3_BUCKET=<bucket>`, `S3_REGION=ap-south-1`,
   `S3_FILE_URL=https://<bucket>.s3.ap-south-1.amazonaws.com`. Then run `sudo docker compose up -d backend`.
5. Add `<bucket>.s3.ap-south-1.amazonaws.com` to the GitHub variable `SHOP_IMAGE_HOSTS` (comma-separated), then
   rerun **Server images** and pull the new storefront image (step 6.3).

Return photos get long random addresses that nobody can guess, but anyone who has the link can open it. Before the
real launch, think about a private bucket with short-lived links.

### 9. Measure it (after setup)
From any computer, with the demo password:
```bash
npx autocannon@8.0.0 -c 10 -d 20 -H "Authorization=Basic $(printf 'demo:<password>' | base64)" https://<SHOP_DOMAIN>/mr
```
Watch the server meanwhile: `free -m` (memory, swap) and `sudo docker stats --no-stream`.

## Everyday commands (in `/opt/shop/app/deploy`)

```bash
sudo docker compose ps                          # what is running
sudo docker compose logs backend --tail 100     # backend logs
sudo docker compose logs storefront --tail 100
sudo docker compose up -d backend               # apply a change in /opt/shop/backend.env
git -C /opt/shop/app pull && sudo docker compose pull && sudo docker compose up -d   # deploy the latest images
free -m && sudo docker stats --no-stream        # memory and swap
ls -l /opt/shop/backups                         # (as root) the backups
```

## Before real customers

- [ ] A bigger server: at least **t3.medium** (4 GB).
- [ ] `NODE_ENV=production` with all real keys.
  - The backend refuses to start without them: Razorpay live, Shiprocket, Message Central, Resend.
  - Remove `OTP_TEST_CODE` and `SMS_PROVIDER=console`.
- [ ] Demo password off (`: > /opt/shop/demo-auth.caddy`) and the real domain in `caddy.env` and the GitHub variables.
- [ ] Photos on S3 (section 8); EBS snapshots on; backups copied to S3.
- [ ] Consider moving Postgres to RDS (managed, automatic backups) once orders are real.
- [ ] Keys that were ever pasted into a chat replaced with new ones.
