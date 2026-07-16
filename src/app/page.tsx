import { redirect } from 'next/navigation';

export default function Home() {
  // Instantly sends anyone visiting the root URL directly to the login page
  redirect('/login');
}