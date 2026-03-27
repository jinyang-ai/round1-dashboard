import { signIn } from '@/auth';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Round1 Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Enter password to access the dashboard
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            Invalid password. Please try again.
          </div>
        )}

        <form
          action={async (formData: FormData) => {
            'use server';
            await signIn('credentials', {
              password: formData.get('password'),
              redirectTo: '/',
            });
          }}
        >
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Enter password"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
