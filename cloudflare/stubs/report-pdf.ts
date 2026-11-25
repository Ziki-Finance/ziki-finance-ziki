/**
 * Cloudflare build stand-in for components/security-checks/report-pdf.tsx.
 * @react-pdf/renderer (pdfkit) can't be bundled for Workers and needs far more
 * than the Free plan's 10 ms of CPU. The report route catches this and tells the
 * person the PDF isn't available on the preview deployment.
 */
export function renderReportPdf(): Promise<never> {
  return Promise.reject(new Error("PDF reports are not available on the Cloudflare preview."));
}
