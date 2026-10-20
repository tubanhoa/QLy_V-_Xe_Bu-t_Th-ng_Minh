export interface InvoiceSeller {
  name: string
  taxCode: string
  address: string
  phone: string
  email: string
  website: string
}

export interface InvoiceBuyer {
  fullName: string
  email: string
  phone?: string
  studentId?: string
  faculty?: string
}

export interface InvoiceItem {
  itemNumber: number
  description: string
  ticketCode: string
  seatNumber: string
  unit: string
  quantity: number
  unitPrice: number
  totalAmount: number
}

export interface InvoiceData {
  id: string
  invoiceNumber: string
  lookupCode: string
  issuedAt: string | Date
  seller: InvoiceSeller
  buyer: InvoiceBuyer
  bookingCode: string
  routeName: string
  origin?: string
  destination?: string
  departureTime: string | Date
  vehiclePlate?: string
  paymentMethod: string
  paymentTransactionId: string
  items: InvoiceItem[]
  subtotalAmount: number
  discountAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  amountInWords: string
  qrLookupData: string
  pdfUrl?: string
  htmlUrl?: string
}

export interface ResendEmailPayload {
  email?: string
}

export interface ResendEmailResult {
  success: boolean
  message: string
  sentTo?: string
  invoiceNumber?: string
}

export interface InvoiceSummaryStats {
  totalInvoices: number
  totalRevenue: number
  totalVatAmount: number
  totalSubtotal: number
}

export interface InvoiceListItem {
  id: string
  invoiceNumber: string
  lookupCode: string
  paymentId: string
  bookingId: string
  userId?: string
  subtotalAmount: number
  discountAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  currency: string
  invoiceData?: Record<string, any>
  pdfUrl?: string
  issuedAt: string
  createdAt: string
  payment?: {
    id: string
    paymentMethod: string
    status: string
  }
  booking?: {
    id: string
    bookingCode: string
    status: string
    user?: {
      fullName?: string
      email?: string
      phoneNumber?: string
    }
    trip?: {
      route?: {
        name?: string
        routeCode?: string
      }
      vehicle?: {
        licensePlate?: string
      }
    }
  }
}

export interface InvoiceListResponse {
  items: InvoiceListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: InvoiceSummaryStats
}

