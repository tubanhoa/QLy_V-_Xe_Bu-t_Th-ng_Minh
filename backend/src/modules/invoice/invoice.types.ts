export interface InvoiceSeller {
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export interface InvoiceBuyer {
  fullName: string;
  email: string;
  phone?: string;
  studentId?: string;
  faculty?: string;
}

export interface InvoiceItem {
  itemNumber: number;
  description: string;
  ticketCode: string;
  seatNumber: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  lookupCode: string;
  issuedAt: Date;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  bookingCode: string;
  routeName: string;
  origin?: string;
  destination?: string;
  departureTime: Date;
  vehiclePlate?: string;
  paymentMethod: string;
  paymentTransactionId: string;
  items: InvoiceItem[];
  subtotalAmount: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  amountInWords: string;
  qrLookupData: string;
}
