/*
 * Copyright (c) 2019 Martin Denham, Tuomas Airaksinen and the And Bible contributors.
 *
 * This file is part of And Bible (http://github.com/AndBible/and-bible).
 *
 * And Bible is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any later version.
 *
 * And Bible is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with And Bible.
 * If not, see http://www.gnu.org/licenses/.
 *
 */

package net.bible.android.database.readingplan

import androidx.room.*
import java.util.Date

class ReadingPlanEntities {

    /** Stores information for plan, like start date and current day user is on.
     * Plans that exist are determined by text files. Row will only exist here for plan
     * that has already been started */
    @Entity(tableName = "readingplan",
        indices = [Index(name = "index_readingplan_plan_code",value=["plan_code"], unique = true)])
    data class ReadingPlanOld(
        @ColumnInfo(name = "plan_code") val planCode: String,
        @ColumnInfo(name = "plan_start_date") var planStartDate: Date,
        @ColumnInfo(name = "plan_current_day", defaultValue = "1") var planCurrentDay: Int = 1,
        @PrimaryKey(autoGenerate = true) @ColumnInfo(name="_id") val id: Int? = null
    )

    @Entity(tableName = "readingplan_status",
        indices = [Index(name="code_day", value = ["plan_code", "plan_day"], unique = true)]
    )
    data class ReadingPlanStatusOld(
        @ColumnInfo(name = "plan_code") val planCode: String,
        @ColumnInfo(name = "plan_day") val planDay: Int,
        @ColumnInfo(name = "reading_status") val readingStatus: String,
        @PrimaryKey(autoGenerate = true) @ColumnInfo(name="_id") val id: Int? = null
    )

    @Entity
    data class ReadingPlan(
        /** Previously called planCode */
        @PrimaryKey
        val fileName: String,
        var name: String?,
        var description: String?,
        var numberOfDays: Int,
        var versification: String,
        var startDate: Date? = null,
        var dayComplete: Int? = null,
        /** This is so that reading plan status can store historical reading records and not only the
         * current reading cycle. This is not a count of how many times the user has been through the plan,
         * it is incremented every time the plan is reset */
        var readIteration: Int? = null,
        /** Keep track of file version, so that db info can be updated if file version is increased */
        var version: Int = 0,
    )

    @Entity(
        primaryKeys = [ "readingPlanFileName", "dayNumber" ],
        indices = [ Index("readingDate") ],
        foreignKeys =
        [
            ForeignKey(entity = ReadingPlan::class, parentColumns = [ "fileName" ], childColumns = [ "readingPlanFileName" ], onDelete = ForeignKey.CASCADE, onUpdate = ForeignKey.CASCADE)
        ]
    )
    data class ReadingPlanDay(
        val readingPlanFileName: String,
        val dayNumber: Int,
        /** For date-based reading plan (e.g. Mar-7 or Dec-29) */
        val readingDate: String?,
        val scriptureToRead: String,
    )

    @Entity(
        primaryKeys = [ "readingPlanFileName", "dayNumber", "readIteration" ],
        foreignKeys =
        [
            ForeignKey(entity = ReadingPlan::class, parentColumns = [ "fileName" ], childColumns = [ "readingPlanFileName" ], onDelete = ForeignKey.CASCADE, onUpdate = ForeignKey.CASCADE)
        ]
    )
    data class ReadingPlanHistory(
        val readingPlanFileName: String,
        val dayNumber: Int,
        /** See note on [ReadingPlan.readIteration]*/
        var readIteration: Int,
        var dateCompleted: Date? = null,
        var readStatus: String? = null,
    )
}
