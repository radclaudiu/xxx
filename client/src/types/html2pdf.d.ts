declare module 'html2pdf.js' {
  interface Options {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type?: string; quality?: number };
    enableLinks?: boolean;
    html2canvas?: object;
    jsPDF?: object;
    pagebreak?: {
      mode?: string;
      before?: string[] | string;
      after?: string[] | string;
      avoid?: string[] | string;
    };
  }

  interface HTML2PDF {
    from(element: HTMLElement | string): HTML2PDF;
    set(options: Options): HTML2PDF;
    save(): Promise<void>;
    outputPdf(): any;
    outputImg(): any;
  }

  function html2pdf(): HTML2PDF;
  function html2pdf(element: HTMLElement | string, options?: Options): HTML2PDF;

  export = html2pdf;
}