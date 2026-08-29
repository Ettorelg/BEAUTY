"use client";
import { QRCodeSVG } from "qrcode.react";
export function QRBookingCode({url}:{url:string}){return <article className="panel"><h2>QR code prenotazioni</h2><p className="muted">Scansionalo con il telefono per aprire la pagina prenotazioni.</p><QRCodeSVG value={url} size={180} includeMargin/><p><a className="ghost-button link-button" href={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">${url}</text></svg>`)}`} download="qr-prenotazioni.svg">Scarica QR</a></p></article>}
