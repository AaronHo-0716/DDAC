#!/usr/bin/env bash
# One-time bootstrap: create the S3 bucket that backs Terraform remote state.
# Run this once per AWS account BEFORE the first `terraform init` against this config.
#
# Usage:
#   ./bootstrap-tfstate.sh
#   TFSTATE_BUCKET=my-name AWS_REGION=ap-southeast-5 ./bootstrap-tfstate.sh
#
# If you change TFSTATE_BUCKET, also update the `bucket` value in the
# `backend "s3"` block in main.tf — backend config can't use variables.

set -euo pipefail

BUCKET="${TFSTATE_BUCKET:-neighbourhelp-tfstate}"
REGION="${AWS_REGION:-ap-southeast-5}"

echo "Creating S3 bucket s3://${BUCKET} in ${REGION}..."

if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "Bucket already exists; skipping create."
else
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}"
fi

aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{ "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }]
  }'

aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo
echo "Bucket ready. Next steps:"
echo "  1. cd deployment/"
echo "  2. terraform init -migrate-state    # migrates existing local state to S3"
echo "     (or just 'terraform init' on a fresh checkout)"
