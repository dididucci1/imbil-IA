# Deploy do Sistema IMBIL

## Arquitetura
- **Frontend**: Vercel/outro hosting
- **Backend**: Fly.dev (já deployado em `imbil-backend.fly.dev`)
- **Banco de Dados**: Neon PostgreSQL

## Passo 1: Configurar Backend no Fly.dev

O backend no Fly.dev precisa da variável `DATABASE_URL`. Execute:

```bash
fly secrets set DATABASE_URL="postgresql://neondb_owner:npg_pxSX81rPztHf@ep-silent-scene-acb466v8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" -a imbil-backend
```

## Passo 2: Deploy do Frontend

### Opção A: Vercel

1. Vá em https://vercel.com
2. Conecte seu repositório GitHub
3. Configure a variável de ambiente:
   - `NEXT_PUBLIC_API_URL` = `https://imbil-backend.fly.dev`
4. Deploy!

### Opção B: Outro hosting

Configure a seguinte variável:
```
NEXT_PUBLIC_API_URL=https://imbil-backend.fly.dev
```

## Para Desenvolvimento Local

1. **Comentar** a linha `NEXT_PUBLIC_API_URL` no `.env`
2. **Manter** apenas `DATABASE_URL`
3. O sistema vai conectar direto ao banco (mais rápido)

Arquivo `.env` para LOCAL:
```
# NEXT_PUBLIC_API_URL=https://imbil-backend.fly.dev
DATABASE_URL=postgresql://neondb_owner:npg_pxSX81rPztHf@ep-silent-scene-acb466v8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Arquivo `.env` para PRODUÇÃO:
```
NEXT_PUBLIC_API_URL=https://imbil-backend.fly.dev
```

## Testar Backend

Execute no PowerShell:
```powershell
curl https://imbil-backend.fly.dev/api/auth/login -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"diego@admin.com","senha":"admin123"}'
```

Se retornar erro 500, o DATABASE_URL não está configurado no Fly.dev.
