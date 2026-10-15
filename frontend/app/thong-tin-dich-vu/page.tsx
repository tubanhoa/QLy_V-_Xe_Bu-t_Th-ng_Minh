import type { Metadata } from 'next'
import { ServiceInfoView } from '@/components/info/service-info-view'

export const metadata: Metadata = {
  metadataBase: new URL('https://transit.ictu.edu.vn'),
  title: 'Thông Tin Dịch Vụ, Chính Sách & Mạng Lưới Tuyến Xe Buýt ICTU Transit',
  description:
    'Cổng thông tin chính thức của ICTU Transit: Chính sách bảo hiểm hành khách 100tr/vụ, biểu phí hoàn hủy vé minh bạch, hóa đơn điện tử Nghị định 123/2020 (MST: 4600123456-001) và công nghệ Geofencing cảnh báo trạm dừng thời gian thực.',
  keywords: [
    'ICTU Transit',
    'xe buýt ICTU',
    'xe buýt điện Thái Nguyên',
    'chính sách hoàn vé xe buýt',
    'hóa đơn điện tử xe buýt',
    'bảo hiểm hành khách',
    'geofencing xe buýt',
    'tuyến xe buýt CT-01',
    'tuyến xe buýt CT-02',
    'vé tháng sinh viên ICTU',
  ],
  alternates: {
    canonical: '/thong-tin-dich-vu',
  },
  openGraph: {
    title: 'Thông Tin Dịch Vụ & Chính Sách Vận Tải Xe Buýt ICTU Transit',
    description:
      'Chính sách bảo mật thanh toán, biểu phí hoàn hủy vé tự động, bảo hiểm hành khách và mạng lưới tuyến xe buýt điện thông minh ICTU Thái Nguyên.',
    url: 'https://transit.ictu.edu.vn/thong-tin-dich-vu',
    siteName: 'ICTU Transit - Hệ Thống Xe Buýt Thông Minh',
    images: [
      {
        url: '/images/info-payment-security.jpg',
        width: 1280,
        height: 720,
        alt: 'Bảo mật thanh toán và thông tin dịch vụ ICTU Transit',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thông Tin Dịch Vụ & Chính Sách Xe Buýt ICTU Transit',
    description:
      'Chính sách bảo hiểm, hoàn hủy vé và công nghệ Geofencing thông minh tại Đại học CNTT & TT Thái Nguyên.',
    images: ['/images/info-payment-security.jpg'],
  },
}

export default function ServiceInfoPage() {
  // Schema JSON-LD Structured Data for High SEO Authority
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Trang chủ',
            item: 'https://transit.ictu.edu.vn',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Thông Tin Dịch Vụ & Chính Sách',
            item: 'https://transit.ictu.edu.vn/thong-tin-dich-vu',
          },
        ],
      },
      {
        '@type': 'TransportationService',
        name: 'Hệ Thống Xe Buýt Thông Minh ICTU Transit',
        serviceType: 'Public Electric Bus Transit & Student Shuttle',
        provider: {
          '@type': 'EducationalOrganization',
          name: 'Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên',
          url: 'https://ictu.edu.vn',
          taxID: '4600123456-001',
          telephone: '1900 8899',
          email: 'support@transit.ictu.edu.vn',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Đường Z115, Xã Quyết Thắng',
            addressLocality: 'Thành phố Thái Nguyên',
            addressRegion: 'Thái Nguyên',
            postalCode: '250000',
            addressCountry: 'VN',
          },
        },
        areaServed: {
          '@type': 'AdministrativeArea',
          name: 'Thái Nguyên',
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Danh Mục Vé Xe Buýt ICTU',
          itemListElement: [
            {
              '@type': 'Offer',
              name: 'Vé lượt 28 chỗ Tuyến CT-01',
              price: '10000',
              priceCurrency: 'VND',
            },
            {
              '@type': 'Offer',
              name: 'Vé lượt Sinh Viên Tuyến CT-01 (Giảm 50%)',
              price: '5000',
              priceCurrency: 'VND',
            },
            {
              '@type': 'Offer',
              name: 'Vé lượt Tuyến CT-02',
              price: '15000',
              priceCurrency: 'VND',
            },
            {
              '@type': 'Offer',
              name: 'Vé lượt Sinh Viên Tuyến CT-02 (Giảm 50%)',
              price: '8000',
              priceCurrency: 'VND',
            },
          ],
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Làm sao để sinh viên ICTU được hưởng mức giảm giá 50% khi mua vé tháng?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Khi đăng ký tài khoản trên hệ thống, bạn chỉ cần chọn đối tượng "Sinh viên", nhập đúng Mã sinh viên ICTU và tải lên ảnh thẻ sinh viên hoặc ảnh chụp VNeID/giấy báo nhập học. Hệ thống sẽ tự động đối soát dữ liệu với cổng đào tạo ICTU hoặc phê duyệt trong vòng 2 - 4 giờ làm việc. Sau khi được duyệt, tất cả vé tháng sẽ tự động giảm 50% vĩnh viễn trong thời gian học tập.',
            },
          },
          {
            '@type': 'Question',
            name: 'Thời gian tôi nhận lại tiền sau khi hủy vé là bao lâu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Đối với giao dịch qua Ví điện tử MoMo / VNPay: Tiền hoàn sẽ về tài khoản trong vòng 5 - 15 phút. Đối với thanh toán qua VietQR hoặc thẻ ngân hàng: Thời gian hoàn tiền từ 12 - 24 giờ làm việc tùy thuộc vào ngân hàng thụ hưởng của hành khách.',
            },
          },
          {
            '@type': 'Question',
            name: 'Tính năng cảnh báo xe sắp đến trạm qua Geofencing hoạt động như thế nào?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Mỗi xe buýt điện thông minh ICTU đều được trang bị thiết bị định vị GPS RTK độ chính xác cao. Khi xe buýt tiến vào bán kính vùng địa lý của trạm (300m trong nội đô hoặc 500m trạm tiêu chuẩn) hoặc thời gian dự kiến đến (ETA) còn dưới 5 phút, máy chủ sẽ tự động gửi thông báo đẩy (Push Notification) kèm chuông báo du dương 3 nốt đến điện thoại của hành khách.',
            },
          },
          {
            '@type': 'Question',
            name: 'Hành khách trên xe buýt ICTU được bảo hiểm như thế nào?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '100% hành khách sở hữu vé xe buýt hợp lệ (vé lượt hoặc vé tháng điện tử) đều được bảo hiểm trách nhiệm dân sự và tai nạn hành khách toàn diện theo hợp đồng số BH-ICTU-2026 với hạn mức bồi thường tối đa lên đến 100.000.000 VNĐ / người / vụ trong suốt hành trình từ khi lên xe cho đến khi xuống trạm.',
            },
          },
          {
            '@type': 'Question',
            name: 'Làm thế nào để lấy hóa đơn GTGT điện tử (VAT 8%) để thanh toán cơ quan?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Sau khi thanh toán thành công, hệ thống tự động xuất hóa đơn điện tử hợp lệ theo Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC do Trường Đại học Công nghệ Thông tin & Truyền thông - ĐH Thái Nguyên (MST: 4600123456-001) phát hành. Bạn có thể truy cập trang Tra Cứu Hóa Đơn Điện Tử, nhập mã vé (VD: ICTU-XXXXXX) để xem chữ ký số và tải file PDF/XML hóa đơn gốc.',
            },
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ServiceInfoView />
    </>
  )
}
