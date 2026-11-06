# Deployment Design

This app isn't deployed. This is how I'd run it on AWS, for one small hiring team of about 10 users and 200 new candidates a month. I'd use the Sydney region (`ap-southeast-2`) to keep candidate data close to its users.

## Architecture

```
Browser
   │
   ├── static files ──► CloudFront ──► S3 (built React app)
   │
   └── /api/* ────────► CloudFront ──► Application Load Balancer
                                              │
                                              ▼
                                       ECS on Fargate (Express container)
                                         │        │          │
                                         ▼        ▼          ▼
                              RDS PostgreSQL   Secrets    Gemini API
                                               Manager    (paid tier)

Container images: ECR        Logs and alarms: CloudWatch
```

## Components and why

| Service | Role | Why this one |
|---|---|---|
| S3 and CloudFront | Hosts the React app, and sends `/api` to the backend | The frontend is only static files. Using one domain also means no CORS setup, like Vite's proxy today |
| ECS on Fargate | Runs the Express container | No servers to patch, and the server runs as one long-lived process, which suits a summary request of up to about 96 seconds. Lambda could work, but would be a bigger change |
| Application Load Balancer | Health checks, and replaces containers without downtime | Standard for Fargate. It's a large share of the cost at this size, so it's the first thing I'd revisit |
| RDS for PostgreSQL | Replaces SQLite | Containers lose local files when replaced, so SQLite wouldn't survive a deployment. RDS adds automatic backups |
| Secrets Manager | Holds the Gemini key and database password | Keeps secrets out of the image and repository |
| CloudWatch | Logs and alarms | Captures server errors, including failed summaries. Resume text shouldn't be logged |
| ECR | Stores container images | Works directly with ECS |

## Changes the app would need

- Replace `node:sqlite` with a PostgreSQL client in `db.ts`. Keeping all SQL in one file limits this change.
- Add a Dockerfile, and read the port and database location from environment variables.
- Add login before any real candidate data goes in. The brief puts this out of scope for the take-home.
- Use a paid Gemini tier, because free-tier inputs may be used for training and the daily limit is too low. Resumes are personal data, so also check where the provider processes them.

## Estimated monthly cost

| Item | Assumption | Per month (USD) |
|---|---|---|
| Fargate | 1 task, 0.25–0.5 vCPU, 0.5–1 GB, always on | $9–18 |
| RDS for PostgreSQL | `db.t4g.micro`, single-AZ, 20 GB | $15 |
| Application Load Balancer | Hourly charge plus light traffic | $18–20 |
| Public IPv4 addresses | 2 for the load balancer, 1 for the task | $11 |
| S3 and CloudFront | Low traffic, largely within the free tier | About $1 |
| Secrets Manager | 2 secrets | About $1 |
| CloudWatch and ECR | A few GB | $2–5 |
| Gemini API | 200 summaries at about 1,000 input and 500 output tokens | Under $1 |
| **Subtotal at US East rates** | | **About $57–72** |
| **Estimate for Sydney** | Allowing up to about 25% more | **About $60–90** |

These are rough figures. They come mostly from third-party pricing pages at US East rates, as I couldn't get Sydney rates, and I'd confirm them in the AWS Pricing Calculator before committing to anything.

The main ways to change the cost:
- **Save money:** remove the load balancer and accept brief downtime when deploying.
- **Add reliability:** Multi-AZ on RDS roughly doubles the database cost, and I'd add it once real data depends on it. Running two tasks also adds to the Fargate cost.
- **Stay simple:** the task sits in a public subnet with its security group limited to the load balancer, because a NAT gateway would add over $30 a month.

## Pricing sources

[Fargate](https://www.opslyft.com/blog/aws-fargate-pricing-calculator), [RDS](https://www.bytebase.com/dbcost/rds/instance/db.t4g.micro/), [load balancer](https://cloudburn.io/blog/aws-elastic-load-balancing-pricing), [IPv4](https://dev.to/codesolutionshub/aws-public-ipv4-charges-a-guide-for-users-and-developers-3nk4), [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/), [AWS Free Tier](https://infratally.com/articles/aws-free-tier-2026.html), [Gemini](https://anotherwrapper.com/llm-pricing/gemini-3.5-flash-lite)
