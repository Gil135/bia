#!/bin/bash
# Script para executar APÓS adicionar AmazonRDSFullAccess ao usuário formacao
# Executa Passos 2 (parcial), 3, 4, 5, 6 do setup RDS para BIA em us-east-2

set -e
REGION="us-east-2"
SG_RDS="sg-09ae1ae20bbe16da7"  # bia-db - já criado

echo "=== Passo 3: Criar DB Subnet Group ==="
aws rds create-db-subnet-group \
  --db-subnet-group-name "bia-subnet-group" \
  --db-subnet-group-description "Subnet group para RDS BIA" \
  --subnet-ids "subnet-074a7bdb90dfb9a3f" "subnet-05b89f24253d3f9a3" "subnet-0f614bd91f0b157a4" \
  --tags Key=Project,Value=bia Key=Environment,Value=test Key=Owner,Value=formacao \
  --region $REGION 2>&1 || echo "Subnet group já existe"

echo ""
echo "=== Passo 3: Criar RDS PostgreSQL ==="
aws rds create-db-instance \
  --db-instance-identifier "bia-db" \
  --db-instance-class "db.t3.micro" \
  --engine "postgres" \
  --engine-version "15.10" \
  --master-username "postgres" \
  --master-user-password "Fn@21872187" \
  --allocated-storage 20 \
  --storage-type "gp2" \
  --db-name "bia" \
  --vpc-security-group-ids "$SG_RDS" \
  --db-subnet-group-name "bia-subnet-group" \
  --no-publicly-accessible \
  --no-multi-az \
  --backup-retention-period 7 \
  --no-deletion-protection \
  --region $REGION \
  --tags Key=Project,Value=bia Key=Environment,Value=test Key=Owner,Value=formacao

echo ""
echo "=== Passo 4: Aguardando RDS ficar available (pode levar 5-10 min) ==="
for i in $(seq 1 30); do
  sleep 30
  STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier "bia-db" \
    --region $REGION \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>&1)
  echo "  Tentativa $i/30 - Status: $STATUS"
  if [ "$STATUS" = "available" ]; then
    RDS_ENDPOINT=$(aws rds describe-db-instances \
      --db-instance-identifier "bia-db" \
      --region $REGION \
      --query 'DBInstances[0].Endpoint.Address' \
      --output text)
    echo "  ✅ RDS AVAILABLE! Endpoint: $RDS_ENDPOINT"
    break
  fi
done

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ]; then
  echo "❌ Timeout aguardando RDS. Execute manualmente após disponível."
  exit 1
fi

echo ""
echo "=== Passo 5: Registrar nova Task Definition electric-app-daycdv:4 ==="
TASK_JSON=$(cat /tmp/task-def-bia-v4.json | sed "s/__RDS_ENDPOINT__/$RDS_ENDPOINT/g")

NEW_TASK_ARN=$(echo "$TASK_JSON" | aws ecs register-task-definition \
  --region $REGION \
  --cli-input-json /dev/stdin \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo "  ✅ Nova task definition: $NEW_TASK_ARN"

echo ""
echo "=== Passo 6: Atualizar serviço ECS ==="
aws ecs update-service \
  --cluster "cluster-dev" \
  --service "dev-service" \
  --task-definition "$NEW_TASK_ARN" \
  --force-new-deployment \
  --region $REGION \
  --query 'service.{Status:status,TaskDef:taskDefinition,Desired:desiredCount}' \
  --output table

echo ""
echo "=== Aguardando serviço estabilizar ==="
for i in $(seq 1 20); do
  sleep 15
  RUNNING=$(aws ecs describe-services \
    --cluster "cluster-dev" \
    --services "dev-service" \
    --region $REGION \
    --query 'services[0].runningCount' \
    --output text)
  PENDING=$(aws ecs describe-services \
    --cluster "cluster-dev" \
    --services "dev-service" \
    --region $REGION \
    --query 'services[0].pendingCount' \
    --output text)
  echo "  Tentativa $i/20 - Running: $RUNNING, Pending: $PENDING"
  if [ "$RUNNING" -ge 1 ] && [ "$PENDING" -eq 0 ]; then
    echo "  ✅ Serviço estabilizado!"
    break
  fi
done

echo ""
echo "=== Passo 7: Validação Final ==="
sleep 30
echo "Target Group Health:"
aws elbv2 describe-target-health \
  --target-group-arn "arn:aws:elasticloadbalancing:us-east-2:070404530055:targetgroup/tg-bia-useast2/e41753926a86d798" \
  --region $REGION

echo ""
echo "Teste /api/versao:"
curl -s -w "\nHTTP: %{http_code}\n" https://galencarprojetos.com.br/api/versao

echo ""
echo "Teste /api/tarefas:"
curl -s -w "\nHTTP: %{http_code}\n" https://galencarprojetos.com.br/api/tarefas
