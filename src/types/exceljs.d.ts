declare module 'exceljs' {
  export class Workbook {
    creator?: string;
    created?: Date;
    addWorksheet(
      name: string,
      options?: {
        views?: Array<{ state?: string; ySplit?: number }>;
      }
    ): Worksheet;
    xlsx: {
      writeBuffer(): Promise<ArrayBuffer | Buffer>;
    };
  }

  export interface Column {
    header: string;
    key: string;
    width?: number;
  }

  export interface Worksheet {
    columns: Column[];
    autoFilter?: {
      from: { row: number; column: number };
      to: { row: number; column: number };
    };
    getRow(row: number): { font?: { bold?: boolean } };
    addRow(values: Record<string, unknown>): void;
  }
}

