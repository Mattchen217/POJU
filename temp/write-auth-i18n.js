const fs = require("fs");
const path = require("path");

function updateAuthJson(locale, patches) {
  const p = path.join("D:/POJU/pojulife/messages", locale, "auth.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  // fields
  j.fields = j.fields || {};
  Object.assign(j.fields, patches.fields || {});
  // signup
  j.signup = j.signup || {};
  Object.assign(j.signup, patches.signup || {});
  // errors
  j.errors = j.errors || {};
  Object.assign(j.errors, patches.errors || {});
  // update signup subtitle if provided
  if (patches.signupSubtitle) j.signup.subtitle = patches.signupSubtitle;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("updated", locale);
}

updateAuthJson("en", {
  signupSubtitle:
    "Enter your email and password, send a verification code, then enter the 6-digit code to finish.",
  fields: {
    showPassword: "Show",
    hidePassword: "Hide",
  },
  signup: {
    sendCode: "Send email verification code",
    sendingCode: "Sending code…",
    resendCode: "Resend code",
    codeSentHint: "Enter the 6-digit code we sent to your email, then create your account.",
    codeRequired: "Send and enter the verification code before creating your account.",
  },
  errors: {
    finishVerifyCta: "Enter verification code",
    email_not_confirmed: "Please verify your email before logging in.",
  },
});

updateAuthJson("zh", {
  signupSubtitle: "输入邮箱和密码，发送验证码，然后输入 6 位验证码完成注册。",
  fields: {
    showPassword: "显示",
    hidePassword: "隐藏",
  },
  signup: {
    sendCode: "发送邮箱验证码",
    sendingCode: "发送中…",
    resendCode: "重新发送",
    codeSentHint: "请输入我们发送到你邮箱的 6 位验证码，然后创建账户。",
    codeRequired: "请先发送并输入验证码，再创建账户。",
  },
  errors: {
    finishVerifyCta: "输入验证码",
    email_not_confirmed: "登录前请先验证邮箱。",
  },
});

updateAuthJson("es", {
  signupSubtitle:
    "Introduce tu correo y contraseña, envía un código de verificación e introduce el código de 6 dígitos para terminar.",
  fields: {
    showPassword: "Mostrar",
    hidePassword: "Ocultar",
  },
  signup: {
    sendCode: "Enviar código de verificación",
    sendingCode: "Enviando código…",
    resendCode: "Reenviar código",
    codeSentHint: "Introduce el código de 6 dígitos que enviamos a tu correo y crea tu cuenta.",
    codeRequired: "Envía e introduce el código de verificación antes de crear la cuenta.",
  },
  errors: {
    finishVerifyCta: "Introducir código de verificación",
    email_not_confirmed: "Verifica tu correo antes de iniciar sesión.",
  },
});

updateAuthJson("fr", {
  signupSubtitle:
    "Saisissez votre e-mail et mot de passe, envoyez un code de vérification, puis entrez le code à 6 chiffres pour terminer.",
  fields: {
    showPassword: "Afficher",
    hidePassword: "Masquer",
  },
  signup: {
    sendCode: "Envoyer le code de vérification",
    sendingCode: "Envoi du code…",
    resendCode: "Renvoyer le code",
    codeSentHint: "Entrez le code à 6 chiffres envoyé à votre e-mail, puis créez votre compte.",
    codeRequired: "Envoyez et saisissez le code de vérification avant de créer le compte.",
  },
  errors: {
    finishVerifyCta: "Saisir le code de vérification",
    email_not_confirmed: "Veuillez vérifier votre e-mail avant de vous connecter.",
  },
});

// de (loader includes it)
updateAuthJson("de", {
  signupSubtitle:
    "E-Mail und Passwort eingeben, Bestätigungscode senden, dann den 6-stelligen Code eingeben.",
  fields: {
    showPassword: "Zeigen",
    hidePassword: "Verbergen",
  },
  signup: {
    sendCode: "E-Mail-Bestätigungscode senden",
    sendingCode: "Code wird gesendet…",
    resendCode: "Code erneut senden",
    codeSentHint: "Gib den 6-stelligen Code aus deiner E-Mail ein und erstelle dein Konto.",
    codeRequired: "Sende und gib den Bestätigungscode ein, bevor du das Konto erstellst.",
  },
  errors: {
    finishVerifyCta: "Bestätigungscode eingeben",
    email_not_confirmed: "Bitte bestätige deine E-Mail, bevor du dich anmeldest.",
  },
});

console.log("i18n done");
