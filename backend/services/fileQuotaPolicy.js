function storageView({ isAdmin, totalUsedBytes, userUsedBytes, totalQuotaBytes, userQuotaBytes }) {
  const usedBytes = isAdmin ? totalUsedBytes : userUsedBytes;
  const quotaBytes = isAdmin ? totalQuotaBytes : userQuotaBytes;

  return {
    scope: isAdmin ? 'system' : 'personal',
    quotaBytes,
    usedBytes,
    availableBytes: Math.max(0, quotaBytes - usedBytes),
    memberQuotaBytes: userQuotaBytes,
    totalQuotaBytes: isAdmin ? totalQuotaBytes : undefined,
    totalUsedBytes: isAdmin ? totalUsedBytes : undefined,
    personalUsedBytes: userUsedBytes,
  };
}

function quotaViolation({ isAdmin, totalUsedBytes, userUsedBytes, uploadBytes, totalQuotaBytes, userQuotaBytes }) {
  if (!isAdmin && userUsedBytes + uploadBytes > userQuotaBytes) {
    return {
      status: 413,
      message: `This upload would exceed your ${Math.round(userQuotaBytes / (1024 ** 3))} GB storage allowance`,
    };
  }

  if (totalUsedBytes + uploadBytes > totalQuotaBytes) {
    return {
      status: 507,
      message: `The storage pool has reached its ${Math.round(totalQuotaBytes / (1024 ** 3))} GB limit`,
    };
  }

  return null;
}

module.exports = { quotaViolation, storageView };
