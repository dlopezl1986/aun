/**
 * Privacy policy and terms of use, as shown in the app (/legal/privacy,
 * /legal/terms). They describe what AUN actually does today; keep them in
 * sync with the code (data stored, providers, deletion) whenever it changes.
 * Owner and contact come from EXPO_PUBLIC_LEGAL_OWNER / EXPO_PUBLIC_CONTACT_EMAIL.
 */
export type LegalDoc = 'privacy' | 'terms';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalText {
  title: string;
  updated: string;
  sections: LegalSection[];
}

interface Ctx {
  owner: string;
  contact: string;
}

const es = {
  privacy: ({ owner, contact }: Ctx): LegalText => ({
    title: 'Política de privacidad',
    updated: 'Última actualización: 17 de octubre de 2026',
    sections: [
      {
        heading: 'Quién es el responsable',
        paragraphs: [`Responsable del tratamiento: ${owner}. Contacto: ${contact}.`],
      },
      {
        heading: 'Qué datos guardamos',
        bullets: [
          'Tu cuenta: nombre, email y la fecha de alta. La contraseña la gestiona Firebase Authentication (Google); AUN nunca la ve ni la guarda.',
          'Lo que creas: tareas, calendarios y eventos, notas del día, carpetas y datos de documentos de 2ndBrain, miembros de la familia, «Para mañana», listas de la compra, recordatorios y avisos.',
          'Datos de menores que tú introduces como madre, padre o tutor (por ejemplo nombre, fecha de nacimiento, colegio, actividades o tallas de tus hijos). La foto de un hijo se guarda solo en tu dispositivo.',
          'Si activas los avisos fuera de la app: tu email para el resumen diario y, si conectas Telegram, el identificador de ese chat.',
          'Con quién compartes: las personas que invitas, su papel (ver o editar) y su nombre.',
        ],
      },
      {
        heading: 'Lo que no guardamos',
        bullets: [
          'Tus correos: si conectas Gmail u Outlook se consultan directamente a Google o Microsoft; los permisos de acceso quedan solo en tu dispositivo.',
          'Los archivos de 2ndBrain: se guardan en tu dispositivo o en tu propio Google Drive (AUN solo ve los archivos que crea él).',
          'No hay publicidad, no vendemos datos y no usamos herramientas de analítica ni de seguimiento de terceros.',
        ],
      },
      {
        heading: 'Para qué los usamos y con qué base',
        bullets: [
          'Prestarte el servicio que pides: guardar tus datos, sincronizarlos entre tus dispositivos y compartirlos con quien tú elijas (ejecución del contrato).',
          'Enviarte los avisos y resúmenes que actives tú mismo, por email o Telegram (tu consentimiento, que puedes retirar en Ajustes → Notificaciones).',
          'Seguridad del servicio y cumplimiento de obligaciones legales.',
        ],
      },
      {
        heading: 'Dónde están y quién interviene',
        paragraphs: [
          'Los datos se guardan en Google Firebase (Firestore y Authentication), que actúa como encargado del tratamiento. Sus servidores están en Estados Unidos; la transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. y en las cláusulas contractuales tipo de Google. También en tu dispositivo, para que la app funcione sin conexión.',
          'Si los activas, los avisos se envían mediante Telegram y por correo electrónico.',
        ],
      },
      {
        heading: 'Quién puede verlos',
        paragraphs: [
          'Solo tú. Si invitas a alguien, verá únicamente lo que compartes con él (la familia y la compra, y los calendarios que marques), con el permiso que le des; puedes quitárselo cuando quieras. Tus tareas, documentos, notas del día y correo nunca se comparten.',
        ],
      },
      {
        heading: 'Cuánto tiempo',
        paragraphs: [
          'Mientras tengas la cuenta. Si eliminas la cuenta (Ajustes → Zona de peligro → Eliminar mi cuenta) se borran tu cuenta y tus datos en la nube y en ese dispositivo; de lo que añadiste en la familia de otra persona solo queda una marca vacía, sin contenido, para que desaparezca también en sus dispositivos. Las invitaciones caducadas se borran solas.',
        ],
      },
      {
        heading: 'Tus derechos',
        paragraphs: [
          `Puedes acceder a tus datos, corregirlos, borrarlos (la app lo permite directamente), oponerte o limitar su uso y pedir una copia, escribiendo a ${contact}. Si crees que no se respetan, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`,
        ],
      },
      {
        heading: 'Menores',
        paragraphs: [
          'AUN está pensada para personas de 14 años o más. Los datos de niños los introduce su madre, padre o tutor, que decide qué guardar y con quién compartirlo, y puede borrarlos en cualquier momento.',
        ],
      },
      {
        heading: 'Seguridad',
        paragraphs: [
          'Las comunicaciones van cifradas (HTTPS). Cada dato está protegido en el servidor para que solo puedan leerlo tu cuenta y las personas con las que lo compartes, y lo comprobamos con pruebas automáticas.',
        ],
      },
      {
        heading: 'Cambios',
        paragraphs: ['Si cambia algo importante te lo indicaremos en la app antes de que se aplique.'],
      },
    ],
  }),
  terms: ({ owner, contact }: Ctx): LegalText => ({
    title: 'Condiciones de uso',
    updated: 'Última actualización: 17 de octubre de 2026',
    sections: [
      {
        heading: 'El servicio',
        paragraphs: [
          `AUN («All You Need») es una app para organizar tu vida personal y familiar: calendarios, tareas, documentos, familia, compras y avisos. La ofrece ${owner} (contacto: ${contact}).`,
        ],
      },
      {
        heading: 'Tu cuenta',
        bullets: [
          'Debes tener 14 años o más y dar datos ciertos.',
          'Eres responsable de tu contraseña y de lo que se haga con tu cuenta.',
          'Puedes eliminar tu cuenta cuando quieras desde la app.',
        ],
      },
      {
        heading: 'Tu contenido',
        paragraphs: [
          'Lo que guardas es tuyo. Nos das permiso solo para almacenarlo, sincronizarlo y mostrarlo a quien tú decidas compartirlo. Si guardas datos de otras personas (por ejemplo de tus hijos o de tu familia), eres responsable de poder hacerlo.',
        ],
      },
      {
        heading: 'Uso correcto',
        bullets: [
          'No uses AUN para nada ilegal ni para guardar o compartir contenido de terceros sin permiso.',
          'No intentes acceder a datos de otras personas, saturar el servicio ni saltarte sus medidas de seguridad.',
        ],
      },
      {
        heading: 'Disponibilidad',
        paragraphs: [
          'Hacemos lo posible para que AUN funcione siempre y no pierda datos, pero no podemos garantizarlo al 100 %. Los avisos fuera de la app (email, Telegram) pueden llegar con retraso. Para lo importante, no dependas solo de un aviso.',
        ],
      },
      {
        heading: 'Responsabilidad',
        paragraphs: [
          'En la medida que permita la ley, no respondemos de daños indirectos por el uso del servicio. Nada de esto limita los derechos que te reconoce la normativa de consumidores.',
        ],
      },
      {
        heading: 'Cambios y baja',
        paragraphs: [
          'Podemos actualizar estas condiciones; si el cambio es importante te avisaremos en la app. Puedes dejar de usar AUN y eliminar tu cuenta en cualquier momento.',
        ],
      },
      {
        heading: 'Ley aplicable',
        paragraphs: ['Se rigen por la ley española. Si eres consumidor, podrás acudir a los tribunales de tu domicilio.'],
      },
    ],
  }),
};

const en = {
  privacy: ({ owner, contact }: Ctx): LegalText => ({
    title: 'Privacy policy',
    updated: 'Last updated: 17 October 2026',
    sections: [
      { heading: 'Who is responsible', paragraphs: [`Data controller: ${owner}. Contact: ${contact}.`] },
      {
        heading: 'What we store',
        bullets: [
          'Your account: name, e-mail and sign-up date. Your password is handled by Firebase Authentication (Google); AUN never sees or stores it.',
          'What you create: tasks, calendars and events, day notes, 2ndBrain folders and document details, family members, “For tomorrow”, shopping lists, reminders and notices.',
          'Data about minors that you enter as their parent or guardian (e.g. your children’s name, birth date, school, activities or sizes). A child’s photo is kept only on your device.',
          'If you turn on notices outside the app: your e-mail for the daily summary and, if you connect Telegram, that chat’s id.',
          'Who you share with: the people you invite, their role (view or edit) and their name.',
        ],
      },
      {
        heading: 'What we do not store',
        bullets: [
          'Your e-mails: if you connect Gmail or Outlook they are read directly from Google or Microsoft; the access permission stays on your device.',
          '2ndBrain files: they are kept on your device or in your own Google Drive (AUN only sees the files it creates).',
          'No advertising, we do not sell data and we use no third-party analytics or tracking.',
        ],
      },
      {
        heading: 'Why we use them and on what basis',
        bullets: [
          'To provide the service you ask for: store your data, sync it between your devices and share it with whoever you choose (performance of the contract).',
          'To send the notices and summaries you turn on, by e-mail or Telegram (your consent, which you can withdraw in Settings → Notifications).',
          'Security of the service and legal obligations.',
        ],
      },
      {
        heading: 'Where they are and who is involved',
        paragraphs: [
          'Data is stored in Google Firebase (Firestore and Authentication), acting as processor. Its servers are in the United States; the transfer relies on the EU-US Data Privacy Framework and Google’s standard contractual clauses. Also on your device, so the app works offline.',
          'If you turn them on, notices are sent through Telegram and by e-mail.',
        ],
      },
      {
        heading: 'Who can see them',
        paragraphs: [
          'Only you. If you invite someone, they see only what you share with them (family and shopping, and the calendars you tick), with the permission you give; you can remove it any time. Your tasks, documents, day notes and e-mail are never shared.',
        ],
      },
      {
        heading: 'How long',
        paragraphs: [
          'As long as you keep the account. If you delete it (Settings → Danger zone → Delete my account) your account and data are deleted in the cloud and on that device; of what you added to someone else’s family only an empty marker, with no content, remains so it disappears from their devices too. Expired invitations are deleted automatically.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You can access, correct, delete (directly in the app), object to or restrict the use of your data and ask for a copy by writing to ${contact}. If you think they are not respected you can complain to your data protection authority (in Spain, aepd.es).`,
        ],
      },
      {
        heading: 'Minors',
        paragraphs: [
          'AUN is meant for people aged 14 or over. Children’s data is entered by their parent or guardian, who decides what to keep and who to share it with, and can delete it at any time.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Connections are encrypted (HTTPS). Every piece of data is protected on the server so only your account and the people you share it with can read it, and we check this with automated tests.',
        ],
      },
      { heading: 'Changes', paragraphs: ['If something important changes we will tell you in the app before it applies.'] },
    ],
  }),
  terms: ({ owner, contact }: Ctx): LegalText => ({
    title: 'Terms of use',
    updated: 'Last updated: 17 October 2026',
    sections: [
      {
        heading: 'The service',
        paragraphs: [
          `AUN (“All You Need”) is an app to organise your personal and family life: calendars, tasks, documents, family, shopping and notices. It is offered by ${owner} (contact: ${contact}).`,
        ],
      },
      {
        heading: 'Your account',
        bullets: [
          'You must be 14 or over and give true details.',
          'You are responsible for your password and for what is done with your account.',
          'You can delete your account any time from the app.',
        ],
      },
      {
        heading: 'Your content',
        paragraphs: [
          'What you store is yours. You only allow us to store it, sync it and show it to whoever you decide to share it with. If you store other people’s data (e.g. your children’s or family’s), you are responsible for being allowed to.',
        ],
      },
      {
        heading: 'Fair use',
        bullets: [
          'Do not use AUN for anything illegal or to store or share third-party content without permission.',
          'Do not try to access other people’s data, overload the service or get around its security.',
        ],
      },
      {
        heading: 'Availability',
        paragraphs: [
          'We do our best so AUN always works and never loses data, but we cannot guarantee it 100%. Notices outside the app (e-mail, Telegram) may arrive late. For important things, do not rely on a notice alone.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          'To the extent the law allows, we are not liable for indirect damages from using the service. Nothing here limits your rights as a consumer.',
        ],
      },
      {
        heading: 'Changes and leaving',
        paragraphs: [
          'We may update these terms; if a change is important we will tell you in the app. You can stop using AUN and delete your account at any time.',
        ],
      },
      { heading: 'Governing law', paragraphs: ['Spanish law applies. As a consumer you may go to the courts where you live.'] },
    ],
  }),
};

export function legalText(doc: LegalDoc, language: string, ctx: Ctx): LegalText {
  return (language.startsWith('es') ? es : en)[doc](ctx);
}
