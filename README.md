# Ring Size Measurement App

A web application that helps users measure their ring size using computer vision and AI.

## Features

- Real-time hand tracking using MediaPipe
- Accurate ring size measurement based on finger width
- AI-powered size recommendations using OpenAI's GPT-4 Vision
- Support for custom size guides
- Mobile-friendly interface

## Technologies Used

- **Next.js 14** - React framework for building the application
- **MediaPipe** - For hand tracking and landmark detection
- **OpenAI GPT-4 Vision** - For analyzing size guides and providing recommendations
- **Tailwind CSS** - For styling
- **TypeScript** - For type safety

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## How It Works

1. The app uses MediaPipe's hand tracking to detect finger landmarks
2. It calculates the finger width based on the landmarks and user's height
3. The size guide (either default or custom) is sent to OpenAI's GPT-4 Vision
4. GPT-4 analyzes the guide and provides a size recommendation with confidence level

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key for GPT-4 Vision access

## License

MIT

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
