// Dependencies
import { ExecutionContext } from '@nestjs/common';

// Common
import {
  AuthenticationException,
  OperationNotAllowedException,
} from '@/common/exceptions';

// Guards
import { PreventSameUserActionGuard } from './user.guards';

// Other
import { createUserFixture } from '@/test/fixtures/user.fixture';

describe('PreventSameUserActionGuard', () => {
  let guard: PreventSameUserActionGuard;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    guard = new PreventSameUserActionGuard();

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should throw AuthenticationException when user is not authenticated', () => {
      // Arrange
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: null,
        params: { id: 'some-user-id' },
      });

      // Act & Assert
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        AuthenticationException
      );
    });

    it('should allow action when target ID is different from current user', () => {
      // Arrange
      const currentUser = createUserFixture({ id: 'user-123' });
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: currentUser,
        params: { id: 'different-user-456' },
      });

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw OperationNotAllowedException when user tries to act on themselves', () => {
      // Arrange
      const currentUser = createUserFixture({ id: 'user-123' });
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: currentUser,
        params: { id: 'user-123' },
      });

      // Act & Assert
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        OperationNotAllowedException
      );
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        'You cannot perform this action on current user'
      );
    });

    it('should allow action when no target ID is provided', () => {
      // Arrange
      const currentUser = createUserFixture({ id: 'user-123' });
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: currentUser,
        params: {},
      });

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow action when params.id is undefined', () => {
      // Arrange
      const currentUser = createUserFixture({ id: 'user-123' });
      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue({
        user: currentUser,
        params: { id: undefined },
      });

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });
  });
});
