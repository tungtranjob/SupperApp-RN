/** Mẫu có sẵn để tạo màn hình mới nhanh. */
export const templates = {
  blank: {
    name: 'Trống',
    layout: {
      type: 'Screen',
      props: { scroll: true, padding: 16, background: '#f4f4f7' },
      children: [{ type: 'Heading', props: { text: 'Màn hình mới' } }],
    },
    onLoad: [],
    initialState: {},
  },

  promo: {
    name: 'Trang khuyến mãi',
    layout: {
      type: 'Screen',
      props: { scroll: true, background: '#f4f4f7' },
      children: [
        { type: 'View', props: { background: '#a50064', padding: 24, radiusBottom: 24 }, children: [
          { type: 'Text', props: { text: '🎁', size: 40 } },
          { type: 'Text', props: { text: 'Ưu đãi tháng 9', color: '#ffffff', size: 22, weight: 'bold' } },
          { type: 'Text', props: { text: 'Hoàn tiền tới 50% cho mọi giao dịch', color: '#f0c8e0', size: 13 } },
        ] },
        { type: 'Card', props: { margin: 16 }, children: [
          { type: 'ListItem', repeat: { items: 'state.deals', as: 'deal' }, props: { emoji: '{{deal.emoji}}', title: '{{deal.title}}', subtitle: '{{deal.desc}}' } },
        ] },
        { type: 'View', props: { padding: 16, paddingTop: 0 }, children: [
          { type: 'Button', props: { title: 'Về trang chủ', variant: 'secondary' }, actions: { onPress: [{ type: 'navigate', to: 'home' }] } },
        ] },
      ],
    },
    onLoad: [],
    initialState: {
      deals: [
        { id: 1, emoji: '☕', title: 'Giảm 30% The Coffee House', desc: 'Áp dụng tới 30/09' },
        { id: 2, emoji: '🎬', title: 'Mua 1 tặng 1 vé phim', desc: 'Thứ 4 hàng tuần' },
        { id: 3, emoji: '🛵', title: 'Freeship Grab 20K', desc: 'Đơn từ 50.000đ' },
      ],
    },
  },

  form: {
    name: 'Form nhập liệu',
    layout: {
      type: 'Screen',
      props: { scroll: true, padding: 20, background: '#ffffff' },
      children: [
        { type: 'Heading', props: { text: 'Chuyển tiền' } },
        { type: 'Spacer', props: { size: 20 } },
        { type: 'Input', props: { label: 'Người nhận', value: '{{state.to}}', placeholder: 'Số điện thoại' },
          actions: { onChangeText: [{ type: 'setState', path: 'to', value: '{{event.text}}' }] } },
        { type: 'Input', props: { label: 'Số tiền', value: '{{state.amount}}', keyboardType: 'numeric' },
          actions: { onChangeText: [{ type: 'setState', path: 'amount', value: '{{event.text}}' }] } },
        { type: 'Banner', props: { text: 'Bạn sắp chuyển {{state.amount}} cho {{state.to}}', tone: 'info' }, if: 'state.amount' },
        { type: 'Spacer', props: { size: 16 } },
        { type: 'Button', props: { title: 'Xác nhận' },
          actions: { onPress: [{ type: 'toast', title: 'Thành công', message: 'Đã chuyển {{state.amount}} cho {{state.to}}' }, { type: 'goBack' }] } },
      ],
    },
    onLoad: [],
    initialState: { to: '', amount: '' },
  },
};
