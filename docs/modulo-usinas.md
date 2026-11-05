# Módulo Usinas

Gestão mensal de usinas alugadas para cooperativa: boletim → recibos → NF de O&M → enviado.
Página: `usinas.html`. Acesso **só do admin da empresa** e **só com o módulo `usinas` ativo** (`empresa_modulos`).
A trava é no banco (RLS + `usinas_acesso(empresa_id)`), não só na tela.

## Tabelas (SQL: passo 1 e passo 2)

| Tabela | Conteúdo |
|---|---|
| `empresas`, `empresa_membros`, `empresa_modulos` | base multiempresa (conta, quem acessa, módulos ativos) |
| `emitentes` | quem assina (CNPJ/CPF), endereço e dados bancários — só admin |
| `contrapartes` | destinatário (ex.: Cooperativa MOVE) |
| `usinas` | UC, cooperativa, emitente de cada documento, numeração (base nº 13 = 08/2026), textos |
| `usina_competencias` | 1 linha por usina × mês: valores do boletim, nº do recibo (trigger), NF, status |
| `usina_documentos` | arquivos (boletim, recibos, NF PDF/XML). **Sem delete**; versão nova marca a antiga em `substituido_por` |
| `erros_app` | erros das telas (para depuração) |

Arquivos: bucket privado `usinas`, caminho `<empresa_id>/<codigo>/<AAAA-MM>/<timestamp>-<nome>`. Sem apagar nem sobrescrever.

## Fluxo da tela

1. **Lançar boletim** (um ou vários PDFs). `js/boletim-leitor.js` lê o texto do PDF no navegador (pdf.js, sem IA)
   com o adaptador `LEITORES_BOLETIM.move` e confere:
   - Terra, Equipamento e O&M do resumo = tabela;
   - Equipamento = contratual + fatura da usina + inadimplência + gestão + ajuste;
   - Resultado = O&M + Terra + Equipamento.
   Se não fechar (ou se algum valor for editado), só salva com "Conferi no boletim…". Nada é inventado.
2. **Gerar recibos**: `js/recibo-usina.js` monta os PDFs no layout dos modelos Word (nº 000013, competência por extenso,
   valor por extenso, emitente/destinatário/banco do cadastro). Os dois ficam guardados e são baixados.
3. **Anexar NF** (PDF do Portal Emissor Nacional e, se tiver, o XML): lê número, chave, data e valor do DANFSe e avisa se o
   CNPJ, o valor (≠ O&M) ou a referência (REF. MM/AAAA) não batem. Quando o módulo NFS-e existir, este passo vira "emitir".
4. **Enviado**: marca a competência como enviada para a cooperativa.

Status: `lancado` → `recibos` → `nf` → `enviado`.

## Outra cooperativa / outro cliente do produto

- Novo layout de boletim: criar um adaptador em `LEITORES_BOLETIM` devolvendo o mesmo formato (`valores`, `conferencias`, `fecha`).
- Nova usina/emitente: só cadastro (tabelas), nenhum código.
- Menu: `js/modulos.js` mostra "☀️ Usinas" no topo das páginas quando o banco deixa ler `usinas`.

## Testes (fora do repositório, Playwright com o banco simulado)

- leitura dos boletins 370 e 371 de 08/2026 (todas as conferências ✓) e do DANFSe nº 9;
- fluxo completo: 2 boletins → salvar → recibos nº 000013 → anexar NF nº 9 → enviado;
- valor por extenso (17 casos) e menu dos módulos no CRM e no Financeiro.

## Depois

Conciliação com a cooperativa (inadimplência, multas da distribuidora, divergências) usa os campos já gravados
(`fatura_usina`, `inadimplencia`, `ajuste`, `leitura`). Resultado mensal por usina e financiamento: próximos passos.
