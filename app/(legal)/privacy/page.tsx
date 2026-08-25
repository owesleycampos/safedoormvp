export const metadata = { title: 'Política de Privacidade' };

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>
        Esta política explica, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei
        13.709/2018), como o Porta Segura trata os dados pessoais usados no controle de
        acesso escolar.
      </p>

      <h2>Quais dados tratamos</h2>
      <ul>
        <li><strong>Do aluno:</strong> nome, turma, data de nascimento, fotografias e os registros de entrada e saída na escola.</li>
        <li><strong>Do responsável:</strong> nome, e-mail, telefone e o vínculo com o(s) aluno(s).</li>
        <li><strong>Biometria facial:</strong> as fotos cadastradas pela escola geram uma representação matemática usada apenas para reconhecer o aluno na portaria. Dado sensível, tratado com salvaguardas reforçadas.</li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Registrar e comunicar entradas e saídas aos responsáveis vinculados.</li>
        <li>Produzir os relatórios de frequência exigidos da escola pela legislação educacional.</li>
      </ul>
      <p>Não vendemos dados nem os usamos para publicidade.</p>

      <h2>Quem é quem na LGPD</h2>
      <p>
        A <strong>escola</strong> é a controladora dos dados dos seus alunos; o Porta
        Segura atua como operador, tratando os dados conforme as instruções dela.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão de dados seus ou do aluno pelo
        qual responde. O pedido deve ser feito à secretaria da escola, que aciona a
        plataforma. A exclusão da biometria pode ser pedida a qualquer momento sem
        prejuízo do registro de frequência já existente.
      </p>

      <h2>Segurança e retenção</h2>
      <ul>
        <li>Comunicação cifrada e acesso restrito por perfil (escola, responsável, plataforma).</li>
        <li>Cada escola só acessa os próprios dados; responsáveis só veem os alunos vinculados.</li>
        <li>Os dados são mantidos enquanto durar o contrato com a escola e os prazos legais de guarda escolar.</li>
      </ul>
    </>
  );
}
