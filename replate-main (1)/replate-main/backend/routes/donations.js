const express = require("express");
const donationRepository = require("../repositories/donationRepository");

const router = express.Router();

/* GET /api/donations
 * Returns currently available donations.*/
router.get("/api/donations", async (req, res) => {
  try {
    const donations = await donationRepository.findAvailable();

  return res.json(donations);
  } catch (error) {
/* Error - unable to retrieve donations */
    console.error("GET /api/donations failed:", error);

   return res.status(500).json({
      error: "Unable to retrieve donations."
    });
  }
});

/* POST /api/donations
 * Creates a new food donation.*/

router.post("/api/donations", async (req, res) => {
  try {
    const {
      food_type,
      quantity,
      quantity_unit,
      pickup_address,
      pickup_date,
      pickup_time,
      claim_deadline,
      additional_information
    } = req.body;

    // Check that all required fields were provided.
    if (
      !food_type ||
      quantity === undefined ||
      !quantity_unit ||
      !pickup_address ||
      !pickup_date ||
      !pickup_time ||
      !claim_deadline
    ) {
      return res.status(400).json({
        error: "Please complete all required donation fields."
      });
    }

    // Quantity must be a positive number.
    const numericQuantity = Number(quantity);

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({
        error: "Quantity must be a positive number."
      });
    }

    // Claim deadline must be a valid date/time in the future.
    const deadline = new Date(claim_deadline);

    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      return res.status(400).json({
        error: "Claim deadline must be in the future."
      });
    }

    /*
     * organization_id is temporarily set to 1 for development.
     * Once authentication is added, this should come from the
     * logged-in user's organization.
     */
    const donationId = await donationRepository.insertDonation({
      organization_id: 1,
      recipient_user_id: null,
      food_type,
      quantity: numericQuantity,
      quantity_unit,
      pickup_address,
      pickup_date,
      pickup_time,
      claim_deadline,
      additional_information
    });

  return res.status(201).json({
      message: "Donation posted successfully.",
      donation_id: donationId
    });
  } catch (error) {
/*Error - Unable to save donation*/
    console.error("POST /api/donations failed:", error);

    return res.status(500).json({
      error: "Unable to save donation."
    });
  }
});

// Update Existing Donation Listing
router.put("/api/donations/:id", async (req, res) => {
  try {
  const donationId = req.params.id;
  const {
    food_type,
    quantity,
    quantity_unit,
    pickup_address,
    pickup_date,
    pickup_time,
    claim_deadline,
    additional_information,
    status
  } = req.body;

    const updates = {};

    if (food_type !== undefined) {
    updates.food_type = food_type;
    }
    if (quantity !== undefined) {
      const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        return res.status(400).json({
          error: "Quantity must be a positive number."
        });
      }

      updates.quantity = numericQuantity;
    }

    if (quantity_unit !== undefined) {
    updates.quantity_unit = quantity_unit;
    }
    if (pickup_address !== undefined) { 
    updates.pickup_address = pickup_address;
    }
    if (pickup_date !== undefined) {
    updates.pickup_date = pickup_date;
    }
    if (pickup_time !== undefined) {
      updates.pickup_time = pickup_time;
    }
    if (claim_deadline !== undefined) {
      const deadline = new Date(claim_deadline);
  
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
        return res.status(400).json({
          error: "Claim deadline must be in the future."
        });
      }

      updates.claim_deadline = claim_deadline;
    }

    if (additional_information !== undefined) {
      updates.additional_information = additional_information;
    }

    if (status !== undefined){
      const validStatuses = [
                "AVAILABLE", 
                "CLAIMED", 
                "COMPLETED"
                ];
    if (!validStatuses.includes(status)){
    return res.status(400).json({
      error:"Status must be one of AVAILABLE, CLAIMED, or COMPLETED."
      });
      }
      updates.status = status;
      }
      
    // Do not run an empty update.
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No fields were provided to update."
      });
     } 
    const result = await donationRepository.updateDonation(
      donationId,
      updates
    );

    if (result === 0) {
      return res.status(404).json({
        error: "Donation not found."
      });
    }

   return res.json({
      message: "Donation listing updated successfully."
    });
  } catch (error) {
    console.error("PUT /api/donations/:id failed:", error);

    return res.status(500).json({
      error: "Unable to update donation."
    });
  }
});

// Delete Existing Donation Listing
router.delete("/api/donations/:id", async (req, res) => {

  try {
    const result = await donationRepository.deleteDonation(req.params.id);

    if (result === 0) {
      return res.status(404).json({
        error: "Donation listing not found."
      });
    }

    return res.json({
      message: "Donation listing deleted successfully."
    });
  } catch (error) {
    console.error("DELETE /api/donations/:id failed:", error);

   return res.status(500).json({
      error: "Database server error."
    });
  }
  });

  /* Search Available Donations with Filters*/
router.get("/search", async (req, res) => {
 try {
  const { food_type, location, status, organization_id } = req.query;
  
  let query = `
   SELECT 
    d.donation_id,
    d.food_type,
    d.quantity,
    d.quantity_unit,
    d.pickup_address,
    d.pickup_date,
    d.pickup_time,
    d.claim_deadline,
    d.additional_information,
    d.status,
    d.created_at,
    o.organization_name,
    o.organization_type
  FROM donations d 
  JOIN organizations o ON d.organization_id = o.organization_id
  WHERE 1=1
  `;
   
  const params = [];
  
  if (food_type) {
    query += ` AND d.food_type LIKE ?`;
    params.push(`%&{food_type}%`);
    }
  if (location) {
    query += ` AND d.pickup_address LIKE ?`;
    params.push(`%&{location}%`);
  }
  if (status) {
    query += ` AND d.status = ?`;
    params.push(status);
  } else { 
    query += ` AND d.status = 'AVAILABLE'`;
  }
  
  query += `ORDER BY d.created_at DESC`;
  
  const [donations] = await pool.query(query, params);
  
  return res.json(donations);
  } catch (error) {
    console.error("GET /api/donations/search failed:", error);
    return res.status(500).json({
      error: "Unable to search donations."
      });
      }
      });
      
  /* Claim a Donation*/
router.post("/:id/claim", async (req, res) => {
  try { 
    const donationId = req.params.id;
    const { recipient_user_id } = req.body;
    
    if (!recipient_user_id) {
      return res.status(400).json({
        error: "Recipient user ID is required to claim a donation."
        });
        }
        
        let connection;
        
        try { 
          connection = await pool.getConnection();
          await connection.beginTransaction();
          
          const [donation] = await connection.query(
            ` SELECT * FROM donations WHERE donation_id = ? AND status = 'AVAILABLE'`,
            [donationId]
            );
            
          if (donation.length === 0) {
            await connection.rollback();
            return res.status(404).json({
              error: "Donation not found or already claimed."
              });
              }
          
          await connection.query(
            ` UPDATE donations SET status = 'CLAIMED', recipient_user_id = ? WHERE donation_id = ?`,
            [recipient_user_id, donationId]
            );
          
          await connection.query(
            ` INSERT INTO notifications (user_id, donation_id, type, message, status)
            SELECT organization_id, ?, 'CLAIM', 'Your donation has been claimed', 'UNREAD'
            FROM donations WHERE donation_id = ?`,
            [donationId, donationId]
            );
          
          await connection.commit();
          
          return res.status(200).json({
            message: "Donation claimed successfully.",
            donation_Id: donationId
            });
          } catch (error) {
            if (connection) {
            await connection.rollback();
            }
            throw error;
          } finally {
            if (connection) {
              connection.release();
            }
          }
        } catch (error) { 
          console.error("POST /api/donations/:id/claim failed:", error);
          return res.status(500).json({
            error: "Unable to claim donation."
          });
        }
      });
      
/* Real-time Status Updates for Listing */
router.get("/:id/status", async (req, res) => {
  try { 
    const donationId = req.params.id;
    
    const [donation] = await pool.query(
      `SELECT
      d.donation_id,
      d.status,
      d.pickup_date,
      d.pickup_time,
      d.claim_deadline,
      d.created_at,
      o.organization_name,
      u.email as recipient_email
   FROM donations d
   JOIN organizations o ON d.organization_id = o.organization_id
   LEFT JOIN users u ON d.recipient_user_id = u.user_id
   WHERE d.donation_id = ?`,
  [donationId]
  );
  
if (donation.length === 0) {
  return res.status(404).json({
    error: "Donation not found."
  });
  }
  
  return res.json(donation[0]);
} catch (error) {
  console.error("GET /api/donations/:id/status failed:", error);
  return res.status(500).json({
    error: "Unable to retrieve donation status."
  });
}
});

/* Confirm Donation Pickup */
router.post("/:id/confirm-pickup", async (req, res) => {
  try {
    const donationId = req.params.id;
    const { confirmed_by_user_id, notes } = req.body;
    
    if (!confirmed_by_user_id) {
      return res.status(400).json({
        error: "User ID is required to confirm pickup."
      });
    }
    
    let connection;
    
    try { 
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      const [donation] = await connection.query(
        `SELECT * FROM donations WHERE donation_id = ? AND status = 'CLAIMED'`,
        [donationId]
      );
      
      if (donation.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: "Donation not found or not in claimed status."
          });
        }
        
        await connection.query(
          `UPDATE donations SET status = 'COMPLETED', pickup_comfirmed_at = NOW(), pickup_comfirmed_by = ? WHERE donation_id = ?`,
          [confirmed_by_user_id, donationId]
          );
          
        await connection.query(
          `INSERT INTO notifications (user_id, donation_id, type, message, status)
          VALUES (?, ?, 'PICKUP_CONFIRMED', ?, 'UNREAD')`,
          [donation[0].organization_id, donationId, `Donation pickup confirmed. Notes: ${notes || 'None'}`]
        );
       
       await connection.commit();
      
       return res.json({
         message: "Pickup confirmed successfully.",
         donation_id: donationId
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      throw error;
    } finally { 
      if (connection) {
        connection.release();
        }
      }
    } catch (error) {
      console.error("POST /api/donations/:id/confirm-pickup failed:", error);
      return res.status(500).json({
        error: "Unable to confirm pickup."
      });
    }
  });
  
/* Donation History for a User*/
router.get("/history/:user_id", async (req, res) => {
  try {
    const userId = req.params.user_id;
    const { role } = req.query;
    
    let query = `
     SELECT 
       d.donation_id,
       d.food_type,
       d.quantity,
       d.quantity_unit,
       d.pickup_address,
       d.pickup_date,
       d.pickup_time,
       d.status,
       d.created_at,
       d.pickup_confirmed_at,
       o.organization_name,
      'donor' as role
    FROM donations d
    JOIN organizations o ON d.organization_id = o.organization_id
    WHERE o.organization_id IN (
     SELECT organization_id FROM users WHERE user_id = ?
    )
    `;
    
    const params = [userId];
    
    if (role === 'recipient') {
      query = `
      SELECT 
       d.donation_id,
       d.food_type,
       d.quantity,
       d.quantity_unit,
       d.pickup_address,
       d.pickup_date,
       d.pickup_time,
       d.status,
       d.created_at,
       d.pickup_confirmed_at,
       o.organization_name,
      'recipient' as role
    FROM donations d
    JOIN organizations o ON d.organization_id = o.organization_id
    WHERE d.recipient_user_id = ?
    `;
    params[0] = userId;
  }
  
  query += ` ORDER BY d.created_at DESC`;
  
  const [history] = await pool.query(query, params);
  
  return res.json(history);
} catch (error) {
  console.error("GET /api/donations/history/:user_id failed:", error);
  return res.status(500).json({
    error: "Unable to retrieve donation history."
   });
  }
});

/* Get all notifications and status updates*/
router.get("/alerts/:user_id", async (req, res) => {
 try {
  const userId = req.params.user_id;
  const { unread_only } = req.query;
  
  let query = `
   SELECT
    n.notifications_id,
    n.donation_id,
    n.type,
    n.message,
    n.status,
    n.created_at,
    d.food_type,
    d.status as donation_status,
    o.organization_name
  FROM notifications n
  LEFT JOIN donations d ON n.donation_id = d.donation_id
  LEFT JOIN organizations o ON d.organization_id = o.organization_id
  WHERE n.user_id = ?
  `;
  
  const params = [userId];
  
  if (unread_only === 'true') {
    query += ` AND n.status = 'UNREAD'`;
  }
  
  query += ` ORDER BY n.created_at DESC`;
  
  const [alerts] = await pool.query(query, params);
  
  return res.json(alerts);
} catch (error) {
  console.error("GET /api/donations/alerts/:user_id failed:", error);
  return res.status(500).json({
    error: "Unable to retrieve alerts."
  });
}
});

/* Mark notification as Read*/
router.put("/alerts/:notification_id/mark-read", async (req, res) => {
  try { 
    const notificationId = req.params.notification_id;
    
    await pool.query(
      `UPDATE notifications SET status = 'READ' WHERE notification_id = ?`,
      [notificationId]
    );
    
    return res.json({
      message: "Notification marked as read."
    });
  } catch (error) {
    console.error("PUT /api/donations/alerts/:notification_id/mark-read failed:", error);
    return res.status(500).json({
      error: "Unable to mark notification as read."
    });
  }
});
module.exports = router;

