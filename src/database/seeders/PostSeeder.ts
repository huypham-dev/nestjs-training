// Dependencies
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';

// Modules
import { Category } from '@/modules/category/category.entity';
import { Post } from '@/modules/post/post.entity';
import { User } from '@/modules/user/user.entity';

// Constants
import { PostStatus } from '@/constants';

export class PostSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    // Fetch existing users and categories
    const users = await em.find(User, {});
    const categories = await em.find(Category, {});

    if (users.length === 0) {
      console.warn('No users found. Please seed users first.');
      return;
    }

    if (categories.length === 0) {
      console.warn('No categories found. Please seed categories first.');
      return;
    }

    const postTitles = [
      'Getting Started with NestJS',
      'Advanced TypeScript Patterns',
      'Building RESTful APIs with Express',
      'Introduction to MikroORM',
      'Testing Strategies for Node.js Applications',
      'Deploying Node.js Apps to Production',
      'Understanding Dependency Injection',
      'Best Practices for API Design',
      'JWT Authentication in NestJS',
      'Database Migrations Made Easy',
      'Error Handling in Web Applications',
      'Caching Strategies for Performance',
      'GraphQL vs REST: A Comparison',
      'Building Scalable Microservices',
      'Introduction to Docker Containers',
      'CI/CD Pipeline Setup Guide',
      'Monitoring and Logging Best Practices',
      'Security Best Practices for Web APIs',
      'Rate Limiting and Throttling',
      'WebSocket Implementation Guide',
      'Understanding CORS and CSRF',
      'Database Indexing Strategies',
      'Query Optimization Techniques',
      'Event-Driven Architecture Patterns',
      'Domain-Driven Design Principles',
      'Clean Code Practices',
      'SOLID Principles Explained',
      'Design Patterns in TypeScript',
      'Test-Driven Development Guide',
      'Code Review Best Practices',
      'API Versioning Strategies',
      'Handling File Uploads Efficiently',
      'Background Jobs with Bull Queue',
      'Real-time Updates with Server-Sent Events',
      'Pagination and Filtering Best Practices',
      'Swagger API Documentation',
      'Environment Configuration Management',
      'Validation with Zod and Class Validator',
      'Building Multi-tenant Applications',
      'Database Transactions and ACID',
      'Message Queues and Event Bus',
      'Performance Testing with Artillery',
      'Load Testing Your API',
      'API Gateway Patterns',
      'Service Discovery in Microservices',
      'Distributed Tracing with OpenTelemetry',
      'Feature Flags Implementation',
      'A/B Testing Strategies',
      'Blue-Green Deployment Guide',
      'Zero-Downtime Deployments',
    ];

    const contentTemplates = [
      'This is a comprehensive guide covering the fundamentals and advanced concepts. We will explore various techniques, best practices, and real-world examples to help you master this topic.',
      'In this tutorial, we dive deep into implementation details. You will learn step-by-step how to build robust solutions while avoiding common pitfalls.',
      'Learn the essential patterns and practices that will help you write better code. This article covers both theoretical concepts and practical applications.',
      'A detailed exploration of key concepts with code examples and explanations. We will walk through examples and discuss the pros and cons of different approaches.',
      'Discover the latest techniques and methodologies used by industry professionals. This guide provides actionable insights you can apply to your projects immediately.',
    ];

    const posts = [];

    for (let i = 0; i < 50; i++) {
      const title = postTitles[i] || `Post Title ${i + 1}`;
      const content =
        contentTemplates[i % contentTemplates.length] +
        `\n\nThis is post number ${i + 1} with additional content to make it more realistic. ` +
        'It contains multiple paragraphs with meaningful information about the topic. ' +
        'The content is designed to be informative and engaging for readers.';

      // Random status (70% published, 30% draft)
      const status =
        Math.random() < 0.7 ? PostStatus.PUBLISHED : PostStatus.DRAFT;

      // Random user
      const user = users[Math.floor(Math.random() * users.length)];

      // Random 1-3 categories
      const numCategories = Math.floor(Math.random() * 3) + 1;
      const selectedCategories: Category[] = [];
      const categoryIndexes = new Set<number>();

      while (categoryIndexes.size < numCategories) {
        categoryIndexes.add(Math.floor(Math.random() * categories.length));
      }

      categoryIndexes.forEach((index) => {
        selectedCategories.push(categories[index]);
      });

      const post = em.create(Post, {
        title,
        content,
        status,
        user,
        imageUrl:
          'https://amzn-s3-blog-app.s3.us-east-1.amazonaws.com/posts/images/original/653706385_940901828488443_4536197330707986168_n.jpg',
        imageThumbnailUrl:
          'https://amzn-s3-blog-app.s3.us-east-1.amazonaws.com/posts/images/thumbnails/thumb-653706385_940901828488443_4536197330707986168_n.jpg',
      });

      // Add categories
      selectedCategories.forEach((category) => {
        post.categories.add(category);
      });

      posts.push(post);
    }

    await em.flush();
    console.log(`Successfully seeded ${posts.length} posts`);
  }
}
