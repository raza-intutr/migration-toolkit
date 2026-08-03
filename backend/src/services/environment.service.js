import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';

const sanitize = ({ password: _, ...environment }) => environment;

export const createEnvironment = async (data) => {
  const existing = await prisma.environment.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new AppError('Environment name already in use', 409);
  }

  const environment = await prisma.environment.create({ data });
  return sanitize(environment);
};

export const getAllEnvironments = async () => {
  const environments = await prisma.environment.findMany({
    orderBy: { created_at: 'asc' },
  });
  return environments.map(sanitize);
};

export const getEnvironmentById = async (id) => {
  const environment = await prisma.environment.findUnique({ where: { id } });
  if (!environment) {
    throw new AppError('Environment not found', 404);
  }
  return sanitize(environment);
};

export const updateEnvironment = async (id, data) => {
  const existing = await prisma.environment.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Environment not found', 404);
  }

  if (data.name && data.name !== existing.name) {
    const clash = await prisma.environment.findUnique({ where: { name: data.name } });
    if (clash) {
      throw new AppError('Environment name already in use', 409);
    }
  }

  const environment = await prisma.environment.update({ where: { id }, data });
  return sanitize(environment);
};

export const deleteEnvironment = async (id) => {
  const existing = await prisma.environment.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Environment not found', 404);
  }

  await prisma.environment.delete({ where: { id } });
  return { id };
};
