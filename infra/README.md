# infra

Deployment and CI assets.

```
infra/
├── terraform/     AWS: RDS, ECS/Fargate, ALB, Secrets Manager
├── docker/        Dockerfiles and local docker-compose
└── ci/            Pipeline definitions
```

## Notes

- API keys live in **AWS Secrets Manager**, never in Terraform variables or committed files (5.2).
- The Calendar Service sits on the critical path of every DAG run. Its availability target is
  still undefined (**O-05**) and needs settling before the ALB and service sizing are fixed.
- Network path from each BU Airflow environment to the Calendar Service — TLS, PrivateLink or VPC
  peering, firewall rules — is Fidelity-owned but blocking for first use (**O-25**).
- The Control Plane UI currently has no authentication (**R-04**). If it is ever deployed
  separately from the single React app, it needs a private ALB or an IP allowlist.
