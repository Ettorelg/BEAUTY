"use client";

import { QRCodeSVG } from "qrcode.react";

export function WhatsAppConnectQr({ url }: { url: string }) {
  return (
    <section className="whatsapp-connect-qr" aria-labelledby="whatsapp-connect-title">
      <div>
        <h3 id="whatsapp-connect-title">Collega dal telefono</h3>
        <p className="muted">
          Inquadra il QR con lo smartphone, accedi come titolare e completa la procedura guidata Meta con il tuo numero WhatsApp Business.
        </p>
        <a className="primary-button link-button" href={url}>Collega da questo dispositivo</a>
      </div>
      <div className="whatsapp-connect-qr-code">
        <QRCodeSVG value={url} size={184} includeMargin aria-label="QR code per collegare WhatsApp Business" />
        <strong>Scansiona per collegare</strong>
      </div>
    </section>
  );
}
