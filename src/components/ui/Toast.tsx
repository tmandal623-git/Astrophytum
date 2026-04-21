// components/ui/Toast.tsx
// Lightweight imperative toast component.
// Wrap your app in <ToastProvider> (context/ToastContext.tsx),
// then call useToast().showToast(...) anywhere in the tree.
//
// Usage:
//   const { showToast } = useToast();
//   showToast('Bid placed!');
//   showToast('Something went wrong.', 'error');
//   showToast('Tip: auctions close in 1 hr.', 'info');

export { ToastProvider, useToast } from '../../context/ToastContext';
