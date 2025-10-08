import React from 'react';

export default function Index() {
  // redirect quickly to /login
  if (typeof window !== 'undefined') window.location.replace('/login');
  return null;
}
