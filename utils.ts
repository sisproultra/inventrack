export const generateLPN = (correlative: number): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  // Format correlative to 8 digits as requested in example 25112600000025
  // Note: The example 25112600000025 implies YYMMDD + 8 digits
  const sequence = correlative.toString().padStart(8, '0');
  
  return `${year}${month}${day}${sequence}`;
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const getStatusColor = (status: 'empty' | 'occupied') => {
  switch (status) {
    case 'empty': return 'bg-emerald-500 hover:bg-emerald-600';
    case 'occupied': return 'bg-orange-500 hover:bg-orange-600';
    default: return 'bg-gray-300';
  }
};