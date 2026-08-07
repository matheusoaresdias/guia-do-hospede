// Contrato do envelope de saída do DeepSeek: marcadores, texto da instrução e parser.
//
// Este módulo existe para que a INSTRUÇÃO enviada no prompt e o PARSER que aplica o
// resultado venham da mesma fonte. Se os dois fossem escritos separadamente, um poderia
// mudar sem o outro e a falha apareceria como "o modelo não segue o formato" — quando na
// verdade seria drift do nosso lado.
//
// Formato (marcadores sempre sozinhos na própria linha):
//
//   <<<ARQUIVO apps/web/src/Foo.tsx MODO=COMPLETO>>>
//   ...conteúdo integral do arquivo...
//   <<<FIM>>>
//
//   <<<ARQUIVO apps/api/src/bar.service.ts MODO=PATCH>>>
//   <<<LOCALIZAR>>>
//   ...trecho exato e único do arquivo atual...
//   <<<SUBSTITUIR>>>
//   ...trecho novo...
//   <<<FIM_PATCH>>>
//   <<<FIM>>>
//
// Um bloco PATCH pode ter vários pares LOCALIZAR/SUBSTITUIR. O parser falha duro em
// qualquer ambiguidade — ver parseEnvelope().

export const MARKERS = {
  arquivo: /^<<<ARQUIVO\s+(\S+)\s+MODO=(COMPLETO|PATCH)>>>$/,
  fim: '<<<FIM>>>',
  localizar: '<<<LOCALIZAR>>>',
  substituir: '<<<SUBSTITUIR>>>',
  fimPatch: '<<<FIM_PATCH>>>',
};

// Texto colado no fim do prompt quando envelope está ligado. Explica o formato E o motivo
// de cada regra — o modo de falha registrado nesta skill é o modelo inventar quando não
// sabe, então cada proibição vem com a consequência concreta.
export function instrucaoEnvelope() {
  return `FORMATO_DE_SAIDA (obrigatório — a resposta é aplicada por um parser mecânico, não por uma pessoa):

Responda APENAS com um ou mais blocos no formato abaixo. Nada fora dos blocos: sem
preâmbulo, sem explicação, sem \`\`\`.

Arquivo novo, ou arquivo curto que muda por inteiro:

<<<ARQUIVO caminho/relativo/a/raiz.ts MODO=COMPLETO>>>
(conteúdo integral do arquivo, do primeiro ao último caractere)
<<<FIM>>>

Arquivo existente em que só um trecho muda (PREFIRA ESTE para arquivo grande):

<<<ARQUIVO caminho/relativo/a/raiz.ts MODO=PATCH>>>
<<<LOCALIZAR>>>
(trecho copiado LETRA POR LETRA do arquivo atual que está no prompt)
<<<SUBSTITUIR>>>
(trecho novo)
<<<FIM_PATCH>>>
<<<FIM>>>

Regras que o parser verifica e que fazem a aplicação FALHAR se quebradas:
- O trecho de LOCALIZAR precisa aparecer EXATAMENTE UMA VEZ no arquivo atual. Se aparecer
  zero vezes (você reescreveu em vez de copiar) ou várias vezes (trecho curto demais, tipo
  \`});\`), nada é aplicado. Inclua linhas de contexto suficientes para ser único.
- Em MODO=COMPLETO é proibido abreviar: nada de \`// ...\`, \`// resto igual\`,
  \`// demais campos\`. O que você escrever SUBSTITUI o arquivo inteiro — abreviar apaga
  código existente.
- Só edite os caminhos listados em FILES. Caminho fora dessa lista é rejeitado.
- Se faltar informação para gerar algum bloco (não recebeu o conteúdo de um arquivo que
  precisa mudar), NÃO invente e NÃO presuma: devolva um único bloco
  <<<ARQUIVO FALTA_CONTEXTO MODO=COMPLETO>>> dizendo exatamente qual arquivo falta.`;
}

class ErroEnvelope extends Error {}

function erro(linha, msg) {
  throw new ErroEnvelope(`linha ${linha}: ${msg}`);
}

/**
 * Converte o texto bruto do envelope numa lista de blocos.
 * Só valida ESTRUTURA — casar LOCALIZAR com o arquivo real é trabalho do applier.
 *
 * @returns {Array<{path: string, modo: 'COMPLETO', conteudo: string}
 *                | {path: string, modo: 'PATCH', pares: Array<{localizar: string, substituir: string}>}>}
 * @throws {Error} em qualquer ambiguidade estrutural
 */
export function parseEnvelope(texto) {
  const linhas = texto.split('\n');
  const blocos = [];
  let estado = 'IDLE';
  let atual = null;
  let buffer = [];
  let parcial = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const n = i + 1;
    const t = linha.trim();
    const abertura = t.match(MARKERS.arquivo);

    if (estado === 'IDLE') {
      if (abertura) {
        atual = { path: abertura[1], modo: abertura[2] };
        buffer = [];
        parcial = null;
        estado = atual.modo === 'COMPLETO' ? 'COMPLETO' : 'PATCH_IDLE';
      } else if (t === MARKERS.fim || t === MARKERS.localizar || t === MARKERS.substituir || t === MARKERS.fimPatch) {
        erro(n, `marcador ${t} fora de um bloco <<<ARQUIVO ...>>>`);
      }
      // Fora de bloco, qualquer outra coisa (inclusive cercas ``` e conversa do modelo) é
      // ignorada de propósito: o que importa é o conteúdo dos blocos.
      continue;
    }

    if (abertura) erro(n, `novo <<<ARQUIVO ...>>> aberto sem fechar o bloco de "${atual.path}"`);

    if (estado === 'COMPLETO') {
      if (t === MARKERS.fim) {
        const conteudo = buffer.join('\n');
        if (conteudo.trim() === '') erro(n, `bloco COMPLETO de "${atual.path}" está vazio`);
        blocos.push({ ...atual, conteudo });
        estado = 'IDLE';
        atual = null;
      } else {
        buffer.push(linha);
      }
      continue;
    }

    if (estado === 'PATCH_IDLE') {
      if (t === MARKERS.localizar) {
        buffer = [];
        estado = 'PATCH_LOCALIZAR';
      } else if (t === MARKERS.fim) {
        if (!atual.pares?.length) erro(n, `bloco PATCH de "${atual.path}" não tem nenhum par LOCALIZAR/SUBSTITUIR`);
        blocos.push(atual);
        estado = 'IDLE';
        atual = null;
      } else if (t !== '') {
        erro(n, `dentro de um bloco PATCH só valem <<<LOCALIZAR>>> ou <<<FIM>>>, veio: ${t.slice(0, 60)}`);
      }
      continue;
    }

    if (estado === 'PATCH_LOCALIZAR') {
      if (t === MARKERS.substituir) {
        const localizar = buffer.join('\n');
        if (localizar.trim() === '') erro(n, `LOCALIZAR vazio em "${atual.path}"`);
        parcial = { localizar };
        buffer = [];
        estado = 'PATCH_SUBSTITUIR';
      } else if (t === MARKERS.fim || t === MARKERS.fimPatch) {
        erro(n, `LOCALIZAR de "${atual.path}" fechado sem <<<SUBSTITUIR>>>`);
      } else {
        buffer.push(linha);
      }
      continue;
    }

    if (estado === 'PATCH_SUBSTITUIR') {
      if (t === MARKERS.fimPatch) {
        atual.pares = atual.pares || [];
        atual.pares.push({ ...parcial, substituir: buffer.join('\n') });
        parcial = null;
        buffer = [];
        estado = 'PATCH_IDLE';
      } else if (t === MARKERS.fim) {
        erro(n, `patch de "${atual.path}" fechado sem <<<FIM_PATCH>>>`);
      } else {
        buffer.push(linha);
      }
      continue;
    }
  }

  if (estado !== 'IDLE') {
    throw new ErroEnvelope(`bloco de "${atual?.path}" não foi fechado (estado ${estado}) — resposta provavelmente truncada; confira finishReason e maxTokens`);
  }
  if (blocos.length === 0) {
    throw new ErroEnvelope('nenhum bloco <<<ARQUIVO ...>>> encontrado na resposta');
  }

  const falta = blocos.find((b) => b.path === 'FALTA_CONTEXTO');
  if (falta) {
    throw new ErroEnvelope(`o modelo declarou FALTA_CONTEXTO em vez de inventar:\n${falta.conteudo ?? ''}`);
  }

  return blocos;
}
